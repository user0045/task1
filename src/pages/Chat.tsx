
import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import ChatList from '@/components/ChatList';
import ChatBox from '@/components/ChatBox';
import AddUserDialog from '@/components/AddUserDialog';
import ChatRequestCard from '@/components/ChatRequestCard';
import { ChatType, MessageType, FileAttachment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

const Chat = () => {
  const [chats, setChats] = useState<ChatType[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatType | null>(null);
  const [messages, setMessages] = useState<Record<string, MessageType[]>>({});
  const [chatRequests, setChatRequests] = useState<any[]>([]);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Fetch chats effect
  useEffect(() => {
    const fetchChats = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Fetch all chats where the current user is part of the conversation
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select(`
            id,
            created_at,
            user1_id,
            user2_id,
            profiles!chats_user1_id_fkey(username, avatar_url),
            profiles!chats_user2_id_fkey(username, avatar_url)
          `)
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
          .order('created_at', { ascending: false });
        
        if (chatError) throw chatError;
        
        // Format chat data
        const formattedChats: ChatType[] = chatData.map(chat => {
          // Determine the other participant in the chat
          const isUser1 = chat.user1_id === user.id;
          const otherUserId = isUser1 ? chat.user2_id : chat.user1_id;
          const otherUserProfile = isUser1 
            ? chat.profiles.find((p: any) => p.id === chat.user2_id) 
            : chat.profiles.find((p: any) => p.id === chat.user1_id);
            
          return {
            id: chat.id,
            participantId: otherUserId,
            participantName: otherUserProfile?.username || 'Unknown user',
            participantImage: otherUserProfile?.avatar_url,
            lastMessage: '',
            lastMessageTime: new Date(chat.created_at),
            unreadCount: 0
          };
        });
        
        setChats(formattedChats);
        
        // If we have chats, select the first one or the one from location state
        if (formattedChats.length > 0) {
          if (location.state?.activeChatId) {
            const chatFromState = formattedChats.find(c => c.id === location.state.activeChatId);
            if (chatFromState) {
              setSelectedChat(chatFromState);
              // Fetch messages for this chat
              fetchMessages(location.state.activeChatId);
            } else {
              setSelectedChat(formattedChats[0]);
              // Fetch messages for the first chat
              fetchMessages(formattedChats[0].id);
            }
          } else {
            setSelectedChat(formattedChats[0]);
            // Fetch messages for the first chat
            fetchMessages(formattedChats[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching chats:', error);
        toast({
          title: "Error",
          description: "Failed to fetch chats. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    const fetchMessages = async (chatId: string) => {
      try {
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            content,
            timestamp,
            read,
            profiles(username)
          `)
          .eq('chat_id', chatId)
          .order('timestamp', { ascending: true });
          
        if (messageError) throw messageError;
        
        const formattedMessages: MessageType[] = messageData.map(msg => ({
          id: msg.id,
          senderId: msg.sender_id,
          senderName: msg.profiles?.username || 'Unknown user',
          receiverId: msg.sender_id === user?.id ? selectedChat?.participantId || '' : user?.id || '',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          read: msg.read
        }));
        
        setMessages(prev => ({
          ...prev,
          [chatId]: formattedMessages
        }));
        
        // Mark messages as read
        if (formattedMessages.some(m => m.senderId !== user?.id && !m.read)) {
          await supabase
            .from('messages')
            .update({ read: true })
            .eq('chat_id', chatId)
            .neq('sender_id', user?.id)
            .eq('read', false);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };
    
    fetchChats();
    
    // Set up real-time subscriptions for new messages
    const messagesSubscription = supabase
      .channel('messages-channel')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${user?.id}`
      }, async (payload) => {
        const { data: senderData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', payload.new.sender_id)
          .single();
          
        const newMessage: MessageType = {
          id: payload.new.id,
          senderId: payload.new.sender_id,
          senderName: senderData?.username || 'Unknown user',
          receiverId: user?.id || '',
          content: payload.new.content,
          timestamp: new Date(payload.new.timestamp),
          read: payload.new.read
        };
        
        // Update messages state
        setMessages(prev => {
          const chatMessages = prev[payload.new.chat_id] || [];
          return {
            ...prev,
            [payload.new.chat_id]: [...chatMessages, newMessage]
          };
        });
        
        // Check if we need to update or add a chat
        const existingChatIndex = chats.findIndex(c => c.id === payload.new.chat_id);
        
        if (existingChatIndex >= 0) {
          // Update existing chat
          const updatedChats = [...chats];
          updatedChats[existingChatIndex] = {
            ...updatedChats[existingChatIndex],
            lastMessage: payload.new.content,
            lastMessageTime: new Date(payload.new.timestamp),
            unreadCount: selectedChat?.id === payload.new.chat_id 
              ? 0 
              : (updatedChats[existingChatIndex].unreadCount || 0) + 1
          };
          setChats(updatedChats);
          
          // If this is the selected chat, mark as read
          if (selectedChat?.id === payload.new.chat_id) {
            await supabase
              .from('messages')
              .update({ read: true })
              .eq('id', payload.new.id);
          }
        } else {
          // Fetch new chat details and add to chats
          fetchChats();
        }
      })
      .subscribe();
      
    return () => {
      messagesSubscription.unsubscribe();
    };
  }, [user, location, toast]);
  
  // Handle navigation to start a chat
  useEffect(() => {
    if (location.state?.startChat && location.state?.participant && user) {
      const participant = location.state.participant;
      
      const existingChat = chats.find(c => c.participantId === participant.id);
      
      if (existingChat) {
        setSelectedChat(existingChat);
      } else {
        handleSendChatRequest(participant.id, participant.name);
      }
      
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, chats, user, navigate, location.pathname]);

  const handleChatSelect = async (chat: ChatType) => {
    setSelectedChat(chat);
    
    // Fetch messages if we don't have them yet
    if (!messages[chat.id] || messages[chat.id].length === 0) {
      try {
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .select(`
            id,
            sender_id,
            content,
            timestamp,
            read,
            profiles(username)
          `)
          .eq('chat_id', chat.id)
          .order('timestamp', { ascending: true });
          
        if (messageError) throw messageError;
        
        const formattedMessages: MessageType[] = messageData.map(msg => ({
          id: msg.id,
          senderId: msg.sender_id,
          senderName: msg.profiles?.username || 'Unknown user',
          receiverId: msg.sender_id === user?.id ? chat.participantId : user?.id || '',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          read: msg.read
        }));
        
        setMessages(prev => ({
          ...prev,
          [chat.id]: formattedMessages
        }));
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    }
    
    // Mark any unread messages as read
    if (messages[chat.id]?.some(m => m.senderId !== user?.id && !m.read)) {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('chat_id', chat.id)
        .neq('sender_id', user?.id)
        .eq('read', false);
        
      // Update the local messages state
      setMessages(prev => ({
        ...prev,
        [chat.id]: prev[chat.id]?.map(m => ({
          ...m,
          read: m.senderId === user?.id ? m.read : true
        }))
      }));
      
      // Update unread count in chat
      setChats(prev => 
        prev.map(c => 
          c.id === chat.id ? { ...c, unreadCount: 0 } : c
        )
      );
    }
  };

  const handleSendMessage = async (content: string, attachment?: FileAttachment) => {
    if (!selectedChat || !user || !content.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: selectedChat.id,
          sender_id: user.id,
          receiver_id: selectedChat.participantId,
          content: content,
          timestamp: new Date().toISOString(),
          read: false
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Add the new message to the messages state
      const newMessage: MessageType = {
        id: data.id,
        senderId: user.id,
        senderName: user.email || 'You',
        receiverId: selectedChat.participantId,
        content: content,
        timestamp: new Date(data.timestamp),
        read: false
      };
      
      setMessages(prev => ({
        ...prev,
        [selectedChat.id]: [...(prev[selectedChat.id] || []), newMessage]
      }));
      
      // Update the chat with the last message
      setChats(prev => 
        prev.map(c => 
          c.id === selectedChat.id 
            ? { 
                ...c, 
                lastMessage: content,
                lastMessageTime: new Date() 
              } 
            : c
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSendChatRequest = async (username: string, displayName?: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to send chat requests.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // If username looks like a UUID, it's probably a user ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
      
      let userId = username;
      
      // If it's not a UUID, look up the user by username
      if (!isUUID) {
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .single();
          
        if (userError) {
          toast({
            title: "User Not Found",
            description: "Could not find a user with that username.",
            variant: "destructive",
          });
          return;
        }
        
        userId = userData.id;
      }
      
      // Check if chat already exists
      const { data: existingChats, error: chatCheckError } = await supabase
        .from('chats')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`)
        .limit(1);
        
      if (chatCheckError) throw chatCheckError;
      
      if (existingChats && existingChats.length > 0) {
        // Chat already exists, just open it
        const existingChat = chats.find(c => c.participantId === userId);
        if (existingChat) {
          setSelectedChat(existingChat);
        } else {
          // Fetch participant details
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', userId)
            .single();
            
          const newChat: ChatType = {
            id: existingChats[0].id,
            participantId: userId,
            participantName: displayName || profileData?.username || 'Unknown user',
            participantImage: profileData?.avatar_url,
            unreadCount: 0,
            lastMessageTime: new Date(existingChats[0].created_at)
          };
          
          setChats(prev => [newChat, ...prev]);
          setSelectedChat(newChat);
        }
      } else {
        // Create new chat
        const { data: newChat, error: createChatError } = await supabase
          .from('chats')
          .insert({
            user1_id: user.id,
            user2_id: userId,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (createChatError) throw createChatError;
        
        // Fetch participant details
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', userId)
          .single();
          
        const formattedChat: ChatType = {
          id: newChat.id,
          participantId: userId,
          participantName: displayName || profileData?.username || 'Unknown user',
          participantImage: profileData?.avatar_url,
          unreadCount: 0,
          lastMessageTime: new Date(newChat.created_at)
        };
        
        setChats(prev => [formattedChat, ...prev]);
        setSelectedChat(formattedChat);
      }
      
      setIsAddUserDialogOpen(false);
      
      toast({
        title: "Chat Created",
        description: `You can now chat with ${displayName || username}.`
      });
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: "Error",
        description: "Failed to create chat. Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleAcceptRequest = (requestId: string) => {
    // Not needed for current implementation
  };

  const handleRejectRequest = (requestId: string) => {
    // Not needed for current implementation
  };

  return (
    <Layout requireAuth>
      <div className="container mx-auto h-[calc(100vh-5rem)] flex">
        <div className="w-full md:w-[30%] border-r">
          <ChatList 
            chats={chats} 
            selectedChatId={selectedChat?.id} 
            onSelectChat={handleChatSelect}
            onAddUser={() => setIsAddUserDialogOpen(true)} 
          />
        </div>
        <div className="hidden md:block md:w-[70%]">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">Loading chats...</p>
            </div>
          ) : selectedChat ? (
            <ChatBox 
              chat={selectedChat} 
              messages={messages[selectedChat.id] || []} 
              onSendMessage={handleSendMessage} 
            />
          ) : (
            <div className="h-full flex items-center justify-center flex-col p-4">
              <p className="text-muted-foreground mb-4">
                {chats.length > 0 
                  ? "Select a chat to start messaging" 
                  : "You don't have any chats yet. Start by adding a user."}
              </p>
              
              {chatRequests.length > 0 && (
                <div className="w-full max-w-md">
                  <h3 className="font-medium mb-3">Chat Requests</h3>
                  {chatRequests.map((request) => (
                    <ChatRequestCard
                      key={request.id}
                      username={request.username}
                      image={request.profileImage}
                      requestorRating={request.requestorRating}
                      doerRating={request.doerRating}
                      timestamp={request.timestamp}
                      onAccept={() => handleAcceptRequest(request.id)}
                      onReject={() => handleRejectRequest(request.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AddUserDialog
        open={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        onSendRequest={handleSendChatRequest}
      />
    </Layout>
  );
};

export default Chat;
