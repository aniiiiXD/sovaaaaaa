# Sova serving image: pinned vLLM OpenAI server.
# The upstream image contains the full server; we pin the tag and wrap startup.
# Build locally is optional (pushes nothing); the GPU box pulls from Docker Hub.
#
#   docker build -t sova-vllm:latest --build-arg VLLM_TAG=v0.11.0 serve/

ARG VLLM_TAG=v0.11.0
FROM vllm/vllm-openai:${VLLM_TAG}

COPY entrypoint.sh /usr/local/bin/sova-entrypoint.sh
RUN chmod +x /usr/local/bin/sova-entrypoint.sh

# Same interface as upstream: args after the image are passed to
# python3 -m vllm.entrypoints.openai.api_server
ENTRYPOINT ["/usr/local/bin/sova-entrypoint.sh"]
