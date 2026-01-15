import mongoose from 'mongoose';

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    status: {
      type: String,
      enum: ['subscribed', 'unsubscribed', 'cleaned', 'pending'],
      default: 'subscribed',
    },
    source: {
      type: String,
      enum: ['website', 'admin', 'api', 'webhook', 'unknown'],
      default: 'website',
    },
    mailchimpId: {
      type: String, // The unique id for the member in Mailchimp (if available/needed)
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribeReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);

export default NewsletterSubscriber;
 