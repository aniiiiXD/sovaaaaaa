"""Gold-label and temperature-scaled decision distillation objectives."""

from __future__ import annotations


def training_loss(logits, label_index: int, *, teacher_logits=None,
                  teacher_weight: float = 0.5, temperature: float = 2.0):
    import torch
    import torch.nn.functional as functional

    if logits.ndim != 2 or tuple(logits.shape) != (1, 3):
        raise ValueError("Expected one three-class student prediction")
    if not isinstance(label_index, int) or isinstance(label_index, bool) or not 0 <= label_index < 3:
        raise ValueError("Invalid gold label index")
    if not 0 <= teacher_weight <= 1 or temperature <= 0:
        raise ValueError("Invalid distillation parameters")
    target = torch.tensor([label_index], dtype=torch.long, device=logits.device)
    gold_loss = functional.cross_entropy(logits.float(), target)
    if teacher_logits is None:
        return gold_loss, {"gold": float(gold_loss.detach().item()), "distill": None}
    teacher = torch.as_tensor(teacher_logits, dtype=torch.float32, device=logits.device)
    if tuple(teacher.shape) != (3,) or not bool(torch.isfinite(teacher).all().item()):
        raise ValueError("Teacher must provide three finite raw logits")
    teacher_prob = functional.softmax(teacher.unsqueeze(0) / temperature, dim=-1)
    student_log_prob = functional.log_softmax(logits.float() / temperature, dim=-1)
    distill_loss = functional.kl_div(student_log_prob, teacher_prob, reduction="batchmean") * temperature ** 2
    total = (1.0 - teacher_weight) * gold_loss + teacher_weight * distill_loss
    return total, {"gold": float(gold_loss.detach().item()), "distill": float(distill_loss.detach().item())}
