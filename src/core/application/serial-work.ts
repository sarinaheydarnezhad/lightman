import { AppError } from '@/core/errors/app-error';

/** A bounded FIFO for one mutable invariant. Rejections never poison subsequent work. */
export class SerialWork {
  private tail: Promise<unknown> = Promise.resolve();
  private count = 0;

  run<T>(action: () => Promise<T>): Promise<T> {
    if (this.count >= 128)
      return Promise.reject(new AppError('unavailable', 'Too many pending changes. Please retry.'));
    this.count++;
    const result = this.tail.then(action, action);
    this.tail = result.then(
      () => {
        this.count--;
      },
      () => {
        this.count--;
      },
    );
    return result;
  }
}
