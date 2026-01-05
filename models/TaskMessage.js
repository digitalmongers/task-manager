import mongoose from 'mongoose';

const taskMessageSchema = new mongoose.Schema(
  {
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
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: function() {
        return this.messageType === 'text';
      },
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'system'],
      default: 'text',
    },
    fileDetails: {
      url: String,
      publicId: String,
      fileName: String,
      fileSize: Number,
      mimeType: String,
      duration: Number, // For voice messages
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    editHistory: [
      {
        content: String,
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskMessage',
      default: null,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        emoji: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isEncrypted: {
      type: Boolean,
      default: true,
    },
    clientSideId: {
      type: String,
      index: true, // For deduplication/ACK
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String,
      siteName: String,
    },
  },
  {
    timestamps: true,
  }
);

// Search Index - Principal Engineer Preference: Specific compound index for performance
taskMessageSchema.index({ task: 1, content: 'text' });
taskMessageSchema.index({ vitalTask: 1, content: 'text' });

// Index for fetching chat history efficiently
taskMessageSchema.index({ task: 1, createdAt: -1 });
taskMessageSchema.index({ vitalTask: 1, createdAt: -1 });

const TaskMessage = mongoose.model('TaskMessage', taskMessageSchema);

export default TaskMessage;
