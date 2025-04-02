
import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import TaskCard from '@/components/TaskCard';
import CreateTaskForm from '@/components/CreateTaskForm';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, ClipboardCheck, User, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskType, ApplicationType, JointTaskMemberType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

const Task = () => {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [appliedTasks, setAppliedTasks] = useState<TaskType[]>([]);
  const [applications, setApplications] = useState<ApplicationType[]>([]);
  const [jointTaskRequests, setJointTaskRequests] = useState<JointTaskMemberType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch user's tasks
  useEffect(() => {
    const fetchUserTasks = async () => {
      try {
        setIsLoading(true);
        if (!user) return;

        // Fetch tasks created by the user
        const { data: createdTasksData, error: createdTasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false });

        if (createdTasksError) throw createdTasksError;

        // Fetch tasks where the user is the doer
        const { data: doerTasksData, error: doerTasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('doer_id', user.id)
          .order('created_at', { ascending: false });

        if (doerTasksError) throw doerTasksError;

        // Process created tasks
        const processedCreatedTasks = await Promise.all(
          (createdTasksData || []).map(async (task) => {
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
              creatorRating: 0,
            };
          })
        );

        // Process doer tasks
        const processedDoerTasks = await Promise.all(
          (doerTasksData || []).map(async (task) => {
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
              creatorRating: 0,
              doerId: task.doer_id,
            };
          })
        );

        setTasks(processedCreatedTasks);
        setAppliedTasks(processedDoerTasks);
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

    fetchUserTasks();
  }, [user, toast]);

  const handleCreateTask = async (task: TaskType) => {
    if (tasks.filter(t => t.status === 'active').length >= 3) {
      toast({
        title: "Limit Reached",
        description: "You can only have 3 active tasks at a time.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: task.title,
          description: task.description,
          location: task.location,
          reward: task.reward,
          deadline: task.deadline.toISOString(),
          task_type: task.taskType,
          creator_id: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Format the returned task
      const newTask: TaskType = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        location: data.location || '',
        reward: data.reward,
        deadline: new Date(data.deadline),
        taskType: data.task_type === 'normal' ? 'normal' : 'joint',
        status: 'active',
        createdAt: new Date(data.created_at),
        creatorId: data.creator_id,
        creatorName: user?.email || 'Unknown user',
        creatorRating: 0,
      };
      
      setTasks([newTask, ...tasks]);
      setIsOpen(false);
      toast({
        title: "Task Created",
        description: "Your task has been created successfully."
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again later.",
        variant: "destructive"
      });
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === taskId 
          ? { ...task, status: 'completed' } 
          : task
      ));
      
      toast({
        title: "Task Cancelled",
        description: "Your task has been cancelled."
      });
    } catch (error) {
      console.error('Error cancelling task:', error);
      toast({
        title: "Error",
        description: "Failed to cancel task. Please try again later.",
        variant: "destructive"
      });
    }
  };

  const handleEditTask = async (updatedTask: TaskType) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: updatedTask.title,
          description: updatedTask.description,
          location: updatedTask.location,
          reward: updatedTask.reward,
          deadline: updatedTask.deadline.toISOString(),
        })
        .eq('id', updatedTask.id);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === updatedTask.id 
          ? updatedTask 
          : task
      ));
      
      toast({
        title: "Task Updated",
        description: "Your task has been updated successfully."
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task. Please try again later.",
        variant: "destructive"
      });
    }
  };

  const handleApplyForTask = (taskId: string, message: string) => {
    // This would be implemented with real data in a later iteration
    toast({
      title: "Feature not implemented",
      description: "Task application will be available soon.",
    });
  };

  const handleJoinJointTask = (taskId: string, needs: string, reward: number) => {
    // This would be implemented with real data in a later iteration
    toast({
      title: "Feature not implemented",
      description: "Joint task requests will be available soon.",
    });
  };

  const getActiveTasks = () => {
    const createdActiveTasks = tasks.filter(task => task.status === 'active');
    const userDoingTasks = appliedTasks.filter(task => task.doerId === user?.id && task.status === 'active');
    return [...createdActiveTasks, ...userDoingTasks];
  };

  const getCreatedTasks = () => {
    return tasks.filter(task => task.creatorId === user?.id);
  };

  return (
    <Layout requireAuth>
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <Tabs defaultValue="active" className="w-full">
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="active">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Active ({getActiveTasks().length})</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="applied">
                  <div className="flex items-center gap-1">
                    <ClipboardCheck className="h-4 w-4" />
                    <span>Applied ({appliedTasks.length})</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="created">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>Created ({getCreatedTasks().length})</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="completed">Completed Tasks</TabsTrigger>
              </TabsList>
              
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <PlusCircle size={18} />
                    Create Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[550px]">
                  <CreateTaskForm 
                    onSubmit={handleCreateTask} 
                    onCancel={() => setIsOpen(false)} 
                  />
                </DialogContent>
              </Dialog>
            </div>
            
            <TabsContent value="active" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">Loading tasks...</p>
                </div>
              ) : getActiveTasks().length > 0 ? (
                <div className="flex flex-col space-y-6">
                  {getActiveTasks().map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onCancel={task.creatorId === user?.id ? handleCancelTask : undefined}
                      onEdit={task.creatorId === user?.id ? handleEditTask : undefined}
                      isOwner={task.creatorId === user?.id}
                      onApply={handleApplyForTask}
                      onJoinJointTask={handleJoinJointTask}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">You don't have any active tasks.</p>
                  <p className="text-muted-foreground">Click the "Create Task" button to create one!</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="applied">
              {isLoading ? (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">Loading tasks...</p>
                </div>
              ) : appliedTasks.length > 0 ? (
                <div className="flex flex-col space-y-6">
                  {appliedTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      isOwner={false}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">You haven't applied to any tasks yet.</p>
                  <p className="text-muted-foreground">Browse the marketplace to find tasks you'd like to complete!</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="created" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">Loading tasks...</p>
                </div>
              ) : getCreatedTasks().length > 0 ? (
                <div className="flex flex-col space-y-6">
                  {getCreatedTasks().map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onCancel={handleCancelTask}
                      onEdit={handleEditTask}
                      isOwner={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">You haven't created any tasks yet.</p>
                  <p className="text-muted-foreground">Click the "Create Task" button to create one!</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="completed">
              {isLoading ? (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">Loading tasks...</p>
                </div>
              ) : tasks.filter(task => task.status === 'completed').length > 0 ? (
                <div className="flex flex-col space-y-6">
                  {tasks
                    .filter(task => task.status === 'completed')
                    .map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        isOwner={true}
                        isCompleted={true}
                      />
                    ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">You don't have any completed tasks yet.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Task;
