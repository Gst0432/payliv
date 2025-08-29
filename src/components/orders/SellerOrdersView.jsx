import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import OrderCard from '@/components/OrderCard';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Clock, Package, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SellerOrdersView = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user, loading: authLoading } = useAuth();
    
    const loadOrders = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
  
      try {
        const { data, error: rpcError } = await supabase.rpc('get_seller_orders_with_product_types', {
            p_user_id: user.id
        });

        if (rpcError) throw rpcError;
        setOrders(data || []);

      } catch (err) {
        console.error("Error loading orders:", err);
        setError(err);
        toast({
          title: 'Erreur',
          description: "Impossible de charger les commandes. " + err.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }, [user, toast]);
  
    useEffect(() => {
      if (!authLoading && user) {
        loadOrders();
      }
    }, [user, authLoading, loadOrders]);
    
    const handleUpdateStatus = async (orderId, newStatus) => {
        const originalOrders = [...orders];
        
        setOrders(prevOrders => prevOrders.map(o => 
            o.id === orderId ? { ...o, status: newStatus } : o
        ));

        const { error: updateError } = await supabase.rpc('update_order_status', {
            p_order_id: orderId,
            p_new_status: newStatus
        });

        if (updateError) {
            toast({ title: 'Erreur', description: "La mise à jour du statut a échoué.", variant: 'destructive' });
            setOrders(originalOrders);
        } else {
            toast({ title: 'Statut mis à jour', description: `La commande a été mise à jour.` });
            
            // Send WhatsApp notification to customer for status updates
            if (newStatus === 'confirmed' || newStatus === 'shipped' || newStatus === 'delivered') {
              try {
                await supabase.functions.invoke('send-order-confirmation-whatsapp', {
                  body: { orderId, recipientType: 'customer' }
                });
              } catch (whatsappError) {
                console.warn('WhatsApp notification failed:', whatsappError);
              }
            }
            
            loadOrders();
        }
    };

    const filterOrders = (statuses) => {
        if (!Array.isArray(orders)) return [];
        return orders.filter(order => statuses.includes(order.status));
    };

    const ongoingOrders = filterOrders(['pending', 'confirmed', 'shipped', 'paid']);
    const completedOrders = filterOrders(['delivered', 'cancelled']);

    const renderOrderList = (orderList, emptyMessage) => {
        if (orderList.length > 0) {
            return orderList.map((order, index) => (
                <OrderCard 
                    key={order.id} 
                    order={order} 
                    onUpdateStatus={handleUpdateStatus} 
                    delay={index * 0.05}
                />
            ));
        }
        return (
            <div className="text-center text-muted-foreground py-16 bg-card rounded-xl border border-border">
                <Package className="w-12 h-12 mx-auto mb-4" />
                <p>{emptyMessage}</p>
            </div>
        );
    };

    if (loading || authLoading) {
        return <div className="text-center p-8">Chargement des commandes...</div>;
    }

    if (error) {
        return (
            <div className="text-center py-16 bg-card rounded-xl border border-destructive/50">
                <WifiOff className="w-12 h-12 mx-auto mb-6 text-destructive" />
                <h3 className="text-xl font-semibold text-card-foreground mb-2">Erreur de chargement</h3>
                <p className="text-muted-foreground mb-6">Impossible de charger vos commandes. Veuillez vérifier votre connexion.</p>
                <Button onClick={loadOrders}><RefreshCw className="w-4 h-4 mr-2" />Réessayer</Button>
            </div>
        );
    }

    return (
        <div>
            <Tabs defaultValue="ongoing">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="ongoing">
                        <Clock className="w-4 h-4 mr-2" />
                        En cours ({ongoingOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="completed">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Terminées ({completedOrders.length})
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="ongoing">
                    <motion.div 
                        className="grid gap-6 mt-6"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderOrderList(ongoingOrders, "Vous n'avez aucune commande en cours.")}
                    </motion.div>
                </TabsContent>
                <TabsContent value="completed">
                    <motion.div 
                        className="grid gap-6 mt-6"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderOrderList(completedOrders, "Vous n'avez aucune commande terminée.")}
                    </motion.div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default SellerOrdersView;