import { NextRequest, NextResponse } from "next/server";
import { getGateway } from "./gateway";
import type { IncomingMessage, ServerResponse } from "http";

interface PaymentInfo {
  verified: boolean;
  payer: string;
  amount: string;
  network: string;
  transaction?: string;
}

export interface PaidNextRequest {
  payment: PaymentInfo | null;
  originalRequest: NextRequest;
}

export async function requirePayment(
  req: NextRequest,
  price: string
): Promise<{ paid: true; payment: PaymentInfo } | { paid: false; response: NextResponse }> {
  const gateway = getGateway();
  const middleware = gateway.require(price);

  return new Promise((resolve) => {
    const fakeReq = createFakeIncomingMessage(req);
    let responseSent = false;

    const fakeRes = createFakeServerResponse((statusCode, headers, body) => {
      responseSent = true;
      if (statusCode === 402) {
        resolve({
          paid: false,
          response: NextResponse.json(
            typeof body === "string" ? JSON.parse(body) : body,
            { status: 402, headers: headers as Record<string, string> }
          ),
        });
      } else {
        resolve({
          paid: false,
          response: new NextResponse(body as string, {
            status: statusCode,
            headers: headers as Record<string, string>,
          }),
        });
      }
    });

    const next = () => {
      if (!responseSent) {
        const payment = (fakeReq as unknown as { payment?: PaymentInfo }).payment;
        resolve({
          paid: true,
          payment: payment ?? {
            verified: true,
            payer: "unknown",
            amount: "0",
            network: "eip155:5042002",
          },
        });
      }
    };

    middleware(
      fakeReq as unknown as Parameters<typeof middleware>[0],
      fakeRes as unknown as Parameters<typeof middleware>[1],
      next
    );
  });
}

function createFakeIncomingMessage(req: NextRequest): Partial<IncomingMessage> {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    method: req.method,
    url: new URL(req.url).pathname,
    headers,
    on: (() => {}) as unknown as IncomingMessage["on"],
    removeListener: (() => {}) as unknown as IncomingMessage["removeListener"],
  };
}

function createFakeServerResponse(
  onFinish: (
    statusCode: number,
    headers: Record<string, string | string[]>,
    body: string
  ) => void
): Partial<ServerResponse> {
  let statusCode = 200;
  const headers: Record<string, string | string[]> = {};
  let body = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {
    statusCode,
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    writeHead(code: number, ...args: unknown[]) {
      statusCode = code;
      const h = args.find((a) => typeof a === "object" && a !== null) as
        | Record<string, string | string[]>
        | undefined;
      if (h) Object.assign(headers, h);
      return res;
    },
    end(...args: unknown[]) {
      const data = args.find(
        (a) => typeof a === "string" || Buffer.isBuffer(a)
      ) as string | Buffer | undefined;
      if (data) body = typeof data === "string" ? data : data.toString();
      onFinish(statusCode, headers, body);
      return res;
    },
    write(data: string | Buffer) {
      body += typeof data === "string" ? data : data.toString();
      return true;
    },
    json(data: unknown) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(data);
      onFinish(statusCode, headers, body);
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
  };

  return res;
}
