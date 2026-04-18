FROM alpine:3.19

RUN apk add --no-cache bash git jq coreutils

COPY verify.sh /verify.sh
RUN chmod +x /verify.sh

ENTRYPOINT ["/verify.sh"]
