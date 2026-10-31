import { createInferenceHandlers } from "./inference";
import { invokeSageMaker } from "./sagemaker";
import { invokeBedrock } from "./bedrock";

export const inference = createInferenceHandlers({ sagemaker: invokeSageMaker, bedrock: invokeBedrock });
