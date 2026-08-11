// Network guard: koi bhi request hamesha ke liye hang na kare.
// Timeout hone par reject karta hai taaki UI "error + retry" dikha sake,
// jhoothi "empty / user not found" screen nahi.
export class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RequestTimeoutError()), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}
