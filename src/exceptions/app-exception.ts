export class AppException extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype); // fix prototype chain
  }
}
