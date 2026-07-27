export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function unsupported(): never {
  throw new ApiError(
    "Esta chamada pertence ao FinnacialUX Core. O FinnacialUX Desktop utiliza o banco SQLite local.",
    501,
  );
}

export const api = {
  get: async <T>(_path: string): Promise<T> => unsupported(),
  post: async <T>(_path: string, _body?: unknown): Promise<T> => unsupported(),
  put: async <T>(_path: string, _body: unknown): Promise<T> => unsupported(),
  patch: async <T>(_path: string, _body: unknown): Promise<T> => unsupported(),
  delete: async <T>(_path: string): Promise<T> => unsupported(),
};
