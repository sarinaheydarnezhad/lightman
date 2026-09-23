import type { Review, ReviewRepository } from '../domain/review-repository';

/** Temporary session-only adapter. */
export class DevelopmentInMemoryReviewRepository implements ReviewRepository {
  private readonly reviews = new Map<string, Review>();

  async listByCard(cardId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter((review) => review.cardId === cardId)
      .map((review) => ({ ...review }));
  }

  async save(review: Review): Promise<void> {
    this.reviews.set(review.id, { ...review });
  }
}
