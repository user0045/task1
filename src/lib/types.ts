
export type UserType = {
  id: string;
  username: string;
  email: string;
  requestorRating: number;
  doerRating: number;
  profileImage?: string;
};

export type TaskType = {
  id: string;
  title: string;
  description: string;
  location: string;
  reward: number;
  deadline: Date;
  taskType: 'normal' | 'joint';
  status: 'active' | 'completed';
  createdAt: Date;
  creatorId: string;
  creatorName: string;
  creatorRating: number;
  doerId?: string;
  doerName?: string;
  doerRating?: number;
  completionCode?: {
    requestor: string;
    doer: string;
  };
};

export type JointTaskMemberType = {
  id: string;
  userId: string;
  username: string;
  taskId: string;
  needs: string;
  reward: number;
  rating: number;
};

export type ApplicationType = {
  id: string;
  taskId: string;
  userId: string;
  username: string;
  message: string;
  rating: number;
  createdAt: Date;
};

export type FileAttachment = {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
};

export type MessageType = {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
  attachment?: FileAttachment;
};

export type ChatType = {
  id: string;
  participantId: string;
  participantName: string;
  participantImage?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
};
