"""SOVA decision head and checkpointed forward over a native Mamba-2 backbone."""

from __future__ import annotations

import torch
from torch import nn
from torch.utils.checkpoint import checkpoint


class MambaDecisionModel(nn.Module):
    """One attention-free contract decision; no vocabulary projection or generation."""

    def __init__(self, backbone: nn.Module, hidden_size: int, *, checkpoint_layers: bool = True) -> None:
        super().__init__()
        if not isinstance(hidden_size, int) or hidden_size <= 0:
            raise ValueError("hidden_size must be positive")
        self.backbone = backbone
        self.head = nn.Linear(hidden_size, 3)
        self.checkpoint_layers = checkpoint_layers

    def encode_hidden(self, input_ids: torch.Tensor) -> torch.Tensor:
        if input_ids.ndim != 2 or input_ids.shape[0] != 1 or input_ids.shape[1] == 0:
            raise ValueError("Input must contain exactly one nonempty unpadded sequence")
        hidden = self.backbone.embedding(input_ids)
        residual = None
        for layer in self.backbone.layers:
            if self.training and self.checkpoint_layers and torch.is_grad_enabled():
                hidden, residual = checkpoint(layer, hidden, residual, use_reentrant=False)
            else:
                hidden, residual = layer(hidden, residual, inference_params=None)
        norm = self.backbone.norm_f
        if not self.backbone.fused_add_norm:
            residual = hidden + residual if residual is not None else hidden
            return norm(residual.to(dtype=norm.weight.dtype))
        # Match the pinned reference implementation's fused final residual/norm.
        from mamba_ssm.models.mixer_seq_simple import RMSNorm, layer_norm_fn
        return layer_norm_fn(hidden, norm.weight, norm.bias, eps=norm.eps, residual=residual,
                             prenorm=False, residual_in_fp32=self.backbone.residual_in_fp32,
                             is_rms_norm=isinstance(norm, RMSNorm))

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        hidden = self.encode_hidden(input_ids)
        return self.head(hidden[:, -1, :].to(dtype=self.head.weight.dtype))
