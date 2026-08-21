import { createServer } from "node:http";
import { connect } from "node:net";

const port = Number.parseInt(process.env.EAC_PROXY_PORT ?? "3128", 10);
const allowedHosts = new Set(
  (process.env.EAC_ALLOWED_HOSTS ?? "api.openai.com")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

const server = createServer((_request, response) => {
  response.writeHead(403, { "content-type": "text/plain" });
  response.end("Only allow-listed HTTPS CONNECT requests are permitted.\n");
});

server.on("connect", (request, client, head) => {
  const separator = request.url?.lastIndexOf(":") ?? -1;
  const host = separator < 0 ? "" : (request.url?.slice(0, separator).toLowerCase() ?? "");
  const targetPort =
    separator < 0 ? 0 : Number.parseInt(request.url?.slice(separator + 1) ?? "", 10);
  if (!allowedHosts.has(host) || targetPort !== 443) {
    client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    console.log(`EAC_PROXY_DENY ${JSON.stringify({ timestamp: new Date().toISOString(), host })}`);
    return;
  }
  const upstream = connect(443, host, () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head.length > 0) upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  upstream.on("error", () => client.destroy());
  client.on("error", () => upstream.destroy());
});

server.listen(port, "0.0.0.0", () => {
  console.log(`EaC egress proxy allows: ${[...allowedHosts].join(", ")}`);
});
