import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, ShoppingBag, Loader2 } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { getStatusColor, getStatusLabel } from '@/lib/utils';

export default function UserPurchases() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*, store:store_id(name, slug)')
        .or(`customer->>email.eq.${user.email},customer_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        toast({ title: 'Erreur', description: 'Impossible de charger vos achats.', variant: 'destructive' });
      } else {
        setOrders(data);
      }
      setLoading(false);
    };
    fetchOrders();
  }, [user, toast]);

  const getCurrencySymbol = (currency) => currency === 'XOF' ? 'FCFA' : (currency || '€');

  return (
    <>
      <Helmet>
        <title>Mes Achats - PayLiv</title>
        <meta name="description" content="Consultez l'historique de tous vos achats effectués sur les boutiques PayLiv." />
      </Helmet>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Mes Achats</h1>
        <Card>
          <CardHeader>
            <CardTitle>Historique de vos commandes</CardTitle>
            <CardDescription>Retrouvez ici toutes les commandes que vous avez passées.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Aucun achat pour le moment</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Explorez notre <Link to="/marketplace" className="text-primary underline">marketplace</Link> pour découvrir des produits !
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commande</TableHead>
                      <TableHead>Boutique</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id.substring(0, 8)}</TableCell>
                        <TableCell>{order.store?.name || 'Boutique supprimée'}</TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{order.total.toLocaleString()} {getCurrencySymbol(order.currency)}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/my-purchases/${order.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Voir les détails
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}