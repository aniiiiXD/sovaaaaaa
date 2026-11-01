type Environment = Record<string, string | undefined>;

// Configuration checks only: provider health and IAM access still require a live run.
export function inferenceConfigured(env: Environment) {
  const provider = env.SOVA_INFERENCE_PROVIDER ?? "fireworks";
  if (provider === "fireworks") return Boolean(env.FIREWORKS_API_KEY
    && /^accounts\/[^/]+\/deployments\/[^/]+$/.test(env.FIREWORKS_DEPLOYMENT ?? ""));
  if (provider === "sagemaker") return Boolean(env.AWS_REGION
    && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(env.SAGEMAKER_ENDPOINT ?? ""));
  return provider === "bedrock" && Boolean(env.AWS_REGION
    && /^arn:aws:bedrock:[a-z0-9-]+:\d{12}:imported-model\/[a-zA-Z0-9]+$/.test(env.BEDROCK_MODEL_ARN ?? "")
    && env.BEDROCK_MODEL_ARN?.split(":")[3] === env.AWS_REGION);
}

export function baselineConfigured(model: string | undefined) {
  return /^(us|global)\.(openai\.gpt-6\.1-sol|anthropic\.claude-opus-5-5)$/.test(model ?? "");
}

// Return only public capability flags. Never pass the environment to a client component.
export function demoAvailability(env: Environment) {
  return {
    liveEnabled: (env.SOVA_DEMO_ACCESS_CODE?.length ?? 0) >= 32
      && (env.SOVA_API_KEY?.length ?? 0) >= 32
      && env.SOVA_INFERENCE_ENABLED === "true" && inferenceConfigured(env),
    baselineConnected: baselineConfigured(env.BEDROCK_DEMO_BASELINE_ID),
    baselineLabel: baselineConfigured(env.BEDROCK_DEMO_BASELINE_ID)
      ? env.BEDROCK_DEMO_BASELINE_ID!.includes("openai.") ? "GPT" : "Claude"
      : "Frontier model",
  };
}
