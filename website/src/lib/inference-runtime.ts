import { createInferenceHandlers } from "./inference";
import { invokeSageMaker } from "./sagemaker";
import { invokeBedrock } from "./bedrock";
import { vllm } from "./vllm";

export const inference = createInferenceHandlers({ sagemaker: invokeSageMaker, bedrock: invokeBedrock, vllm });
