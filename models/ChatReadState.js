import mongoose from 'mongoose';

const chatReadStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: false,
      index: true,
    },
    vitalTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VitalTask',
      required: false,
      index: true,
    },
    lastReadSequence: {
      type: Number,
      default: 0,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
    isVital: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookups and upserts
chatReadStateSchema.index({ user: 1, task: 1 }, { unique: true, sparse: true });
chatReadStateSchema.index({ user: 1, vitalTask: 1 }, { unique: true, sparse: true });

const ChatReadState = mongoose.model('ChatReadState', chatReadStateSchema);

export default ChatReadState;
