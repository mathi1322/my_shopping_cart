export interface Review {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}
