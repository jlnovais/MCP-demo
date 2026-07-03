/**
 * Result without payload.
 * Maps from C# Result.
 */
export class Result {
  Success: boolean = false;
  ErrorCode: number = 0;
  ErrorDescription: string = '';
  ErrorDescription2: string = '';

  constructor(init?: Partial<Result>) {
    this.Success = init?.Success ?? false;
    this.ErrorCode = init?.ErrorCode ?? 0;
    this.ErrorDescription = init?.ErrorDescription ?? '';
    this.ErrorDescription2 = init?.ErrorDescription2 ?? '';
  }
}

/**
 * Result with typed payload.
 * Maps from C# Result<T>.
 */
export class ResultOf<T> extends Result {
  ReturnedObject: T | null = null;

  constructor(init?: Partial<ResultOf<T>>) {
    super(init);
    this.ReturnedObject = init?.ReturnedObject ?? null;
  }
}
