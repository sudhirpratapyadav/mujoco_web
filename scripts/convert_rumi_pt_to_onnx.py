"""Convert Rumi rsl_rl actor (.pt) to a deployable ONNX file.

Usage:
  /tmp/rumi-convert-env/bin/python scripts/convert_rumi_pt_to_onnx.py \
      --in /home/linux5/sudhir/rumi_mjlab_copy/model_2999.pt \
      --out public/policy/policy.onnx

The rsl_rl actor in the checkpoint is a stochastic Gaussian-MLP policy:
  Linear(48, 512) -> ELU -> Linear(512, 256) -> ELU -> Linear(256, 128) -> ELU -> Linear(128, 12)
plus a learned per-action `std` (length 12). For deterministic deployment we
drop `std` and emit only the mean — so the ONNX is a pure feed-forward MLP with
input `obs` shape [1, 48] and output `actions` shape [1, 12].
"""
import argparse
import torch
import torch.nn as nn

OBS_DIM = 48
ACT_DIM = 12


class RumiActor(nn.Module):
    def __init__(self):
        super().__init__()
        # Indices match the state_dict layout (mlp.0/2/4/6 for Linear layers,
        # mlp.1/3/5 for ELU). nn.Sequential preserves that mapping.
        self.mlp = nn.Sequential(
            nn.Linear(OBS_DIM, 512),
            nn.ELU(),
            nn.Linear(512, 256),
            nn.ELU(),
            nn.Linear(256, 128),
            nn.ELU(),
            nn.Linear(128, ACT_DIM),
        )

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        return self.mlp(obs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='inp', required=True)
    ap.add_argument('--out', dest='out', required=True)
    args = ap.parse_args()

    ckpt = torch.load(args.inp, map_location='cpu', weights_only=False)
    sd = ckpt['actor_state_dict']

    # Strip the `std` parameter — it's not used for deterministic inference.
    sd_no_std = {k: v for k, v in sd.items() if k != 'std'}

    actor = RumiActor()
    missing, unexpected = actor.load_state_dict(sd_no_std, strict=True)
    assert not missing and not unexpected, f'missing={missing} unexpected={unexpected}'
    actor.eval()

    dummy = torch.zeros(1, OBS_DIM, dtype=torch.float32)
    expected = actor(dummy).detach()
    print('sanity forward output[0..4]:', expected[0, :4].tolist())

    torch.onnx.export(
        actor,
        (dummy,),
        args.out,
        input_names=['obs'],
        output_names=['actions'],
        dynamic_axes={'obs': {0: 'batch'}, 'actions': {0: 'batch'}},
        opset_version=17,
        # Use the legacy TorchScript exporter so weights are inlined into a
        # single .onnx file (onnxruntime-web only fetches policy.onnx; the new
        # dynamo exporter splits weights into a sidecar .onnx.data file).
        dynamo=False,
    )
    print(f'wrote {args.out}')

    # Cross-check by running the exported ONNX.
    import onnxruntime as ort
    sess = ort.InferenceSession(args.out, providers=['CPUExecutionProvider'])
    out = sess.run(['actions'], {'obs': dummy.numpy()})[0]
    diff = (torch.from_numpy(out) - expected).abs().max().item()
    print(f'torch vs onnx max-abs diff: {diff:.2e}')
    assert diff < 1e-5, 'ONNX output differs from torch'
    print('OK')


if __name__ == '__main__':
    main()
