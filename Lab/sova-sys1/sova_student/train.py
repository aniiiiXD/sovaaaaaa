"""Controlled one-epoch full-parameter student training."""

from __future__ import annotations

import math
import random
import time

from .loss import training_loss


def train_epoch(model, items, *, mode: str, device: str, learning_rate: float,
                weight_decay: float, accumulation: int, teacher_weight: float,
                temperature: float, seed: int, on_progress=None) -> dict:
    import torch

    if mode not in ("labels_only", "distilled"):
        raise ValueError("Unknown student training variant")
    if not items or accumulation < 1 or learning_rate <= 0 or weight_decay < 0:
        raise ValueError("Invalid student training settings")
    model.train()
    parameters = [(name, parameter) for name, parameter in model.named_parameters() if parameter.requires_grad]
    if not parameters:
        raise ValueError("No trainable student parameters")
    if any(parameter.dtype != torch.float32 for _, parameter in parameters):
        raise ValueError("Trainable student parameters must remain FP32 for mixed precision")
    decay, no_decay = [], []
    for name, parameter in parameters:
        if (parameter.ndim < 2 or name.endswith("bias") or name.endswith(".A_log") or
            name.endswith(".D") or getattr(parameter, "_no_weight_decay", False)):
            no_decay.append(parameter)
        else:
            decay.append(parameter)
    optimizer = torch.optim.AdamW([
        {"params": decay, "weight_decay": weight_decay},
        {"params": no_decay, "weight_decay": 0.0},
    ], lr=learning_rate, foreach=False)
    total_steps = math.ceil(len(items) / accumulation)
    warmup_steps = max(1, int(total_steps * 0.05)) if total_steps >= 20 else 0

    def scale_lr(step: int) -> float:
        if warmup_steps and step < warmup_steps:
            return step / warmup_steps
        return max(0.0, (total_steps - step) / max(1, total_steps - warmup_steps))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, scale_lr)
    is_cuda = device == "cuda"
    scaler = torch.cuda.amp.GradScaler(init_scale=128.0, enabled=is_cuda)
    order = list(range(len(items)))
    random.Random(seed).shuffle(order)
    count = teacher_count = steps = 0
    total_loss = total_gold = total_kd = 0.0
    started = time.monotonic()
    for offset in range(0, len(order), accumulation):
        group = order[offset:offset + accumulation]
        for attempt in range(4):
            optimizer.zero_grad(set_to_none=True)
            group_loss = group_gold = group_kd = 0.0
            group_teacher = 0
            for index in group:
                item = items[index]
                input_ids = torch.tensor([item.input_ids], dtype=torch.long, device=device)
                with torch.autocast(device_type="cuda" if is_cuda else "cpu", dtype=torch.float16, enabled=is_cuda):
                    logits = model(input_ids)
                    teacher = item.teacher_logits if mode == "distilled" else None
                    loss, components = training_loss(logits, item.label_index, teacher_logits=teacher,
                                                     teacher_weight=teacher_weight, temperature=temperature)
                value = float(loss.detach().item())
                if not math.isfinite(value):
                    raise RuntimeError("Non-finite loss; stopping the student run")
                scaler.scale(loss / len(group)).backward()
                group_loss += value
                group_gold += components["gold"]
                if components["distill"] is not None:
                    group_kd += components["distill"]
                    group_teacher += 1
            scaler.unscale_(optimizer)
            grad_norm = torch.nn.utils.clip_grad_norm_([parameter for _, parameter in parameters], 1.0)
            if math.isfinite(float(grad_norm.detach().item())):
                break
            if not is_cuda or attempt == 3:
                raise RuntimeError("Non-finite gradients after retry; stopping the student run")
            scaler.update(new_scale=scaler.get_scale() / 2)
            print(f"{mode}: gradient overflow, retrying group with a lower FP16 loss scale", flush=True)
        scaler.step(optimizer)
        scaler.update()
        scheduler.step()
        steps += 1
        count += len(group)
        teacher_count += group_teacher
        total_loss += group_loss
        total_gold += group_gold
        total_kd += group_kd
        if on_progress and (steps % 25 == 0 or steps == total_steps):
            on_progress(steps, total_steps, count, len(items), total_loss / count)
    # Do not include stale training gradients in inference memory measurements.
    model.zero_grad(set_to_none=True)
    return {
        "variant": mode, "epochs": 1, "trained_examples": count, "examples_with_teacher": teacher_count,
        "optimizer_steps": steps, "gradient_accumulation": accumulation, "learning_rate": learning_rate,
        "weight_decay": weight_decay, "warmup_steps": warmup_steps, "seed": seed,
        "temperature": temperature if mode == "distilled" else None,
        "teacher_weight": teacher_weight if mode == "distilled" else None,
        "mean_loss": total_loss / count, "mean_gold_loss": total_gold / count,
        "mean_distillation_loss_on_teacher_examples": total_kd / teacher_count if teacher_count else None,
        "trainable_parameters": sum(parameter.numel() for _, parameter in parameters),
        "elapsed_seconds": time.monotonic() - started,
    }
