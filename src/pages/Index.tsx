
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import TaskCard from '@/components/TaskCard';
import { TaskType } from '@/lib/types';
import { PlusCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        // Fetch profile information separately for each task
        const tasksWithProfiles: TaskType[] = await Promise.all(
          data.map(async (task) => {
            // Get the creator's profile
            const { data: profileData } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', task.creator_id)
              .single();
            
            // Ensure the status is either 'active' or 'completed'
            const status = task.status === 'active' || task.status === 'completed' 
              ? task.status as 'active' | 'completed'
              : 'active'; // Default to 'active' if it's neither
              
            // Ensure taskType is either 'normal' or 'joint'
            const taskType = task.task_type === 'joint' ? 'joint' : 'normal';
            
            return {
              id: task.id,
              title: task.title,
              description: task.description || '',
              location: task.location || '',
              reward: task.reward,
              deadline: task.deadline ? new Date(task.deadline) : new Date(),
              taskType: taskType as 'normal' | 'joint',
              status: status,
              createdAt: new Date(task.created_at),
              creatorId: task.creator_id,
              creatorName: profileData?.username || 'Unknown user',
              creatorRating: 0, // We don't have ratings yet in our schema
            };
          })
        );

        setTasks(tasksWithProfiles);
        setFilteredTasks(tasksWithProfiles);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        toast({
          title: "Error",
          description: "Failed to fetch tasks. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [toast]);

  const handleSearch = (term: string) => {
    const lowerCaseTerm = term.toLowerCase();
    setSearchTerm(lowerCaseTerm);
    
    const filtered = tasks.filter(task => 
      task.title.toLowerCase().includes(lowerCaseTerm) || 
      task.description.toLowerCase().includes(lowerCaseTerm) || 
      task.location.toLowerCase().includes(lowerCaseTerm)
    );
    
    setFilteredTasks(filtered);
  };

  return (
    <Layout onSearch={handleSearch} requireAuth>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold text-primary">Available Tasks</h1>
          <Link to="/task">
            <Button className="flex items-center gap-2">
              <PlusCircle size={20} />
              Create Task
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <p>Loading tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-10">
            <h2 className="text-2xl font-semibold text-gray-500">No tasks found</h2>
            <p className="mt-2 text-gray-400">Try adjusting your search or create a new task</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-6">
            {filteredTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                isOwner={user?.id === task.creatorId}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
