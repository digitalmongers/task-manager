import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const chatConversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // Index for faster queries by user
  },
  title: {
    type: String,
    default: 'New Conversation'
  },
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for getting recent conversations
chatConversationSchema.index({ user: 1, updatedAt: -1 });

const ChatConversation = mongoose.model('ChatConversation', chatConversationSchema);

export default ChatConversation;
