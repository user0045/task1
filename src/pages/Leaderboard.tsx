
import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Clock, Award, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import MaskedUsername from '@/components/MaskedUsername';

interface LeaderboardUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  tasksCompleted: number;
  responseTime: number; // in minutes
  completionRate: number; // percentage
}

const Leaderboard = () => {
  const [topUsers, setTopUsers] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Generate some mock data for the leaderboard
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);

        // Fetch profiles
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, created_at')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        // For a real app, we would need to fetch task completion stats and ratings
        // but for now we'll generate some mock data
        const mockLeaderboard = profiles.map((profile, index) => ({
          id: profile.id,
          username: profile.username || `user${index + 1}`,
          avatarUrl: profile.avatar_url,
          rating: Number((4 + Math.random()).toFixed(1)),
          tasksCompleted: Math.floor(Math.random() * 50) + 1,
          responseTime: Math.floor(Math.random() * 60) + 5,
          completionRate: Math.floor(Math.random() * 30) + 70,
        }));

        setTopUsers(mockLeaderboard);
      } catch (error) {
        console.error('Error fetching leaderboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Sort users based on the selected criteria
  const getTopRatedUsers = () => {
    return [...topUsers].sort((a, b) => b.rating - a.rating);
  };

  const getMostTasksCompletedUsers = () => {
    return [...topUsers].sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  };

  const getFastestResponseUsers = () => {
    return [...topUsers].sort((a, b) => a.responseTime - b.responseTime);
  };

  const getHighestCompletionRateUsers = () => {
    return [...topUsers].sort((a, b) => b.completionRate - a.completionRate);
  };

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Leaderboard</h1>

        <Tabs defaultValue="rating">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-8">
            <TabsTrigger value="rating">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <span className="hidden sm:inline">Top Rated</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">Most Tasks</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="response">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Fastest Response</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="completion">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Completion Rate</span>
              </div>
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="py-12 text-center">
              <p className="text-xl text-muted-foreground">Loading leaderboard data...</p>
            </div>
          ) : (
            <>
              <TabsContent value="rating" className="mt-0">
                <LeaderboardTab 
                  users={getTopRatedUsers()} 
                  title="Top Rated Users" 
                  metric="Rating"
                  valueFormatter={(value) => `${value.toFixed(1)}`}
                  highlightColor="text-yellow-500"
                  icon={<Star className="h-4 w-4" />}
                />
              </TabsContent>

              <TabsContent value="tasks" className="mt-0">
                <LeaderboardTab 
                  users={getMostTasksCompletedUsers()} 
                  title="Most Tasks Completed" 
                  metric="Tasks"
                  valueFormatter={(value) => value.toString()}
                  highlightColor="text-green-500"
                  icon={<Award className="h-4 w-4" />}
                />
              </TabsContent>

              <TabsContent value="response" className="mt-0">
                <LeaderboardTab 
                  users={getFastestResponseUsers()} 
                  title="Fastest Response Time" 
                  metric="Avg. Response"
                  valueFormatter={(value) => `${value}m`}
                  highlightColor="text-blue-500"
                  icon={<Clock className="h-4 w-4" />}
                />
              </TabsContent>

              <TabsContent value="completion" className="mt-0">
                <LeaderboardTab 
                  users={getHighestCompletionRateUsers()} 
                  title="Highest Completion Rate" 
                  metric="Completion"
                  valueFormatter={(value) => `${value}%`}
                  highlightColor="text-purple-500"
                  icon={<TrendingUp className="h-4 w-4" />}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

interface LeaderboardTabProps {
  users: LeaderboardUser[];
  title: string;
  metric: string;
  valueFormatter: (value: number) => string;
  highlightColor: string;
  icon: React.ReactNode;
}

const LeaderboardTab = ({ 
  users, 
  title, 
  metric, 
  valueFormatter, 
  highlightColor,
  icon
}: LeaderboardTabProps) => {
  const getMetricValue = (user: LeaderboardUser) => {
    switch (metric) {
      case 'Rating': return user.rating;
      case 'Tasks': return user.tasksCompleted;
      case 'Avg. Response': return user.responseTime;
      case 'Completion': return user.completionRate;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      
      <div className="grid grid-cols-1 gap-4">
        {users.map((user, index) => (
          <Card key={user.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 flex items-center justify-center w-8 font-bold">
                  {index + 1}
                </div>
                
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                    ) : (
                      <AvatarFallback>
                        {user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  <div>
                    <MaskedUsername username={user.username} showChars={3} className="font-medium" />
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {user.tasksCompleted} tasks
                      </Badge>
                      
                      <div className="flex items-center text-yellow-500 text-xs">
                        <Star className="h-3 w-3 mr-0.5 fill-current" />
                        {user.rating.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`font-bold text-lg ${highlightColor}`}>
                  {valueFormatter(getMetricValue(user))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
