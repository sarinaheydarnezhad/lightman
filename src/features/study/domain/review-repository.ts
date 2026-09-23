export interface Review {
  readonly id: string;
  readonly cardId: string;
  readonly reviewedAt: string;
  readonly outcome: 'recalled' | 'forgotten';
}

export interface ReviewRepository {
  listByCard(cardId: string): Promise<Review[]>;
  save(review: Review): Promise<void>;
}
