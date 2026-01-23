import mongoose from 'mongoose';

const sitemapPageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'URL is required'],
      unique: true,
      trim: true,
      // Ensure URL starts with /
      validate: {
        validator: function(v) {
          return v.startsWith('/');
        },
        message: 'URL must start with /'
      }
    },
    priority: {
      type: String,
      default: '0.7',
      enum: ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1.0']
    },
    changefreq: {
      type: String,
      default: 'weekly',
      enum: ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']
    },
    lastmod: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Index for fast lookups
sitemapPageSchema.index({ url: 1 });

const SitemapPage = mongoose.model('SitemapPage', sitemapPageSchema);

export default SitemapPage;
