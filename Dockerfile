FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y python3 python3-pip g++ build-essential procps bc && \
    rm -rf /var/lib/apt/lists/*

# create non-root user and submission dir
RUN useradd -m runner
RUN mkdir -p /submission && chown -R runner:runner /submission

COPY runner.sh /usr/local/bin/runner.sh

# 🚨 CRITICAL FIX: Remove Windows line endings (\r) from the script
RUN sed -i 's/\r$//' /usr/local/bin/runner.sh

RUN chmod +x /usr/local/bin/runner.sh && chown runner:runner /usr/local/bin/runner.sh

USER runner
WORKDIR /submission
ENTRYPOINT ["/usr/local/bin/runner.sh"]