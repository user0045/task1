
import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, Mail, Star, Award, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import UserStatistics from '@/components/UserStatistics';

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [stats, setStats] = useState({
    tasksCreated: 0,
    tasksCompleted: 0,
    tasksInProgress: 0,
    rating: 0,
    reviewsCount: 0,
    responseRate: 0,
    completionRate: 0
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Fetch profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (profileError) throw profileError;
        
        setProfile(profileData);
        setUsername(profileData.username || "");
        setFullName(profileData.full_name || "");
        setBio(profileData.bio || "");
        setAvatarUrl(profileData.avatar_url);
        
        // Fetch tasks created by user
        const { data: createdTasks, error: createdTasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('creator_id', user.id);
          
        if (createdTasksError) throw createdTasksError;
        
        // Fetch tasks where user is doer
        const { data: doerTasks, error: doerTasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('doer_id', user.id);
          
        if (doerTasksError) throw doerTasksError;
        
        // Calculate stats
        const created = createdTasks?.length || 0;
        const inProgress = (doerTasks || []).filter(t => t.status === 'active').length;
        const completed = (doerTasks || []).filter(t => t.status === 'completed').length;
        
        setStats({
          tasksCreated: created,
          tasksCompleted: completed,
          tasksInProgress: inProgress,
          rating: 4.5, // Dummy rating for now
          reviewsCount: 12, // Dummy count for now
          responseRate: 85, // Dummy rate for now
          completionRate: 90 // Dummy rate for now
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: "Error",
          description: "Failed to fetch profile data",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user, toast]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      let newAvatarUrl = avatarUrl;
      
      // Upload avatar if a new one is selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}.${fileExt}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
          
        newAvatarUrl = publicUrlData.publicUrl;
      }
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username,
          full_name: fullName,
          bio,
          avatar_url: newAvatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      setAvatarUrl(newAvatarUrl);
      setProfile(prev => ({ ...prev, username, full_name: fullName, bio, avatar_url: newAvatarUrl }));
      setEditMode(false);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully"
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }
    
    const file = e.target.files[0];
    setAvatarFile(file);
    
    // Create a preview URL
    const objectUrl = URL.createObjectURL(file);
    setAvatarUrl(objectUrl);
  };

  return (
    <Layout requireAuth>
      <div className="container mx-auto py-8">
        <div className="grid grid-cols-1 gap-8">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary/50 via-primary to-accent"></div>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-4 border-background">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={username} />
                    ) : (
                      <AvatarFallback className="text-2xl">
                        {username?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  {editMode && (
                    <label 
                      htmlFor="avatar-upload" 
                      className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                    >
                      Change
                      <input 
                        id="avatar-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  {editMode ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <Input 
                            id="username" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            placeholder="Username"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name</Label>
                          <Input 
                            id="fullName" 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            placeholder="Full Name"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea 
                          id="bio" 
                          value={bio} 
                          onChange={(e) => setBio(e.target.value)} 
                          placeholder="Tell us about yourself"
                          rows={3}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                        <h2 className="text-2xl font-bold">{fullName || username}</h2>
                        {username !== fullName && username && (
                          <Badge variant="outline" className="text-sm self-center md:self-auto">@{username}</Badge>
                        )}
                      </div>
                      
                      {bio && (
                        <p className="text-muted-foreground mt-2">{bio}</p>
                      )}
                      
                      <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <UserCircle className="h-4 w-4 mr-1" />
                          <span>Member since {new Date(profile?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                        </div>
                        
                        {user?.email && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Mail className="h-4 w-4 mr-1" />
                            <span>{user.email}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                <div>
                  {editMode ? (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setEditMode(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveProfile}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => setEditMode(true)}>
                      Edit Profile
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Tabs defaultValue="activity">
            <TabsList className="grid grid-cols-2 mb-8">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="activity" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <AlertCircle className="mr-2 h-5 w-5 text-yellow-500" />
                      Active Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.tasksInProgress}</div>
                    <p className="text-sm text-muted-foreground">Tasks you're currently working on</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                      Completed Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.tasksCompleted}</div>
                    <p className="text-sm text-muted-foreground">Tasks you've successfully completed</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center">
                      <Star className="mr-2 h-5 w-5 text-yellow-500" />
                      Rating
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      <div className="text-3xl font-bold mr-2">{stats.rating.toFixed(1)}</div>
                      <div className="flex">
                        {Array(5).fill(0).map((_, i) => (
                          <Star 
                            key={i} 
                            className={`h-5 w-5 ${i < Math.round(stats.rating) ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Based on {stats.reviewsCount} reviews</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="statistics" className="mt-0">
              {user && (
                <UserStatistics 
                  userId={user.id}
                  username={username || user.email?.split('@')[0] || 'User'}
                  tasksCreated={stats.tasksCreated}
                  tasksCompleted={stats.tasksCompleted}
                  tasksInProgress={stats.tasksInProgress}
                  rating={stats.rating}
                  reviewsCount={stats.reviewsCount}
                  joinDate={profile?.created_at ? new Date(profile.created_at) : undefined}
                  responseRate={stats.responseRate}
                  completionRate={stats.completionRate}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
