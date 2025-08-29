import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { Plus, Store, ShoppingBag, TrendingUp, Users, Lock, WifiOff, Wallet } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { useNavigate } from 'react-router-dom';
    import { toast } from '@/components/ui/use-toast';
    import StoreCard from '@/components/StoreCard';
    import StatsCard from '@/components/StatsCard';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { useProfile } from '@/contexts/ProfileContext';
    import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
    import PageLoader from '@/components/PageLoader';
    import CreateStoreWizard from '@/components/store/CreateStoreWizard';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { DataTablePagination } from '@/components/DataTablePagination';

    const STORES_PER_PAGE = 6;

    export default function SellerDashboard() {
      const navigate = useNavigate();
      const { user, loading: authLoading } = useAuth();
      const { profile, networkError, isSubscriptionActive } = useProfile();
      const [stores, setStores] = useState([]);
      const [stats, setStats] = useState({
        totalStores: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalCustomers: 0,
        withdrawableBalance: 0,
      });
      const [loading, setLoading] = useState(true);
      const [mainCurrency, setMainCurrency] = useState('XOF');
      const [isWizardOpen, setIsWizardOpen] = useState(false);
      const [currentPage, setCurrentPage] = useState(1);
      const [totalStores, setTotalStores] = useState(0);

      const fetchDashboardData = useCallback(async () => {
        if (!user) {
          if (!authLoading) setLoading(false);
          return;
        }
        setLoading(true);

        const from = (currentPage - 1) * STORES_PER_PAGE;
        const to = from + STORES_PER_PAGE - 1;

        const { data: userStats, error: statsError } = await supabase.rpc('get_user_stats', { p_user_id: user.id });
        const { data: ledgerData, error: ledgerError } = await supabase.from('ledgers').select('balance').eq('user_id', user.id).maybeSingle();
        const { data: storesData, error: storesError, count } = await supabase.from('stores').select('*', { count: 'exact' }).eq('user_id', user.id).range(from, to).order('created_at', { ascending: false });

        if (statsError) {
          toast({ title: 'Erreur', description: "Impossible de charger les statistiques.", variant: 'destructive' });
        } else if (userStats) {
          setStats(prev => ({ ...prev, ...userStats }));
        }

        if (ledgerError && ledgerError.code !== 'PGRST116') {
          console.error("Error fetching ledger balance:", ledgerError);
        } else {
          setStats(prev => ({ ...prev, withdrawableBalance: ledgerData?.balance || 0 }));
        }

        if (storesError) {
          toast({ title: 'Erreur', description: "Impossible de charger les boutiques.", variant: 'destructive' });
        } else {
          setStores(storesData || []);
          setTotalStores(count || 0);
          setStats(prev => ({ ...prev, totalStores: count || 0 }));
        }
        
        await loadSettings();
        setLoading(false);
      }, [user, authLoading, currentPage]);

      useEffect(() => {
        if (networkError) {
            if (!authLoading) setLoading(false);
            return;
        };
        fetchDashboardData();
      }, [user, networkError, fetchDashboardData]);

      // Auto-refresh stats every 30 seconds when component is active
      useEffect(() => {
        if (!user || networkError) return;
        
        const interval = setInterval(() => {
          fetchDashboardData();
        }, 30000); // 30 seconds
        
        return () => clearInterval(interval);
      }, [user, networkError, fetchDashboardData]);

      const loadSettings = async () => {
        if (!user) return;
        const { data, error } = await supabase
          .from('settings')
          .select('payments')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            console.error("Error loading settings:", error);
        }

        if (data && data.payments && data.payments.currency) {
          setMainCurrency(data.payments.currency);
        }
      };
      
      const viewStore = (storeSlug) => navigate(`/s/${storeSlug}`);
      const editStore = (storeId) => navigate(`/store/${storeId}/design`); // Updated to new store manager layout
      const deleteStore = async (storeId) => {
        const { error } = await supabase.from('stores').delete().eq('id', storeId);
        if (error) {
          toast({ title: "Erreur", description: "La suppression de la boutique a échoué.", variant: 'destructive' });
        } else {
          toast({ title: "Boutique supprimée", description: "La boutique a été supprimée avec succès." });
          fetchDashboardData();
        }
      };

      const copyStoreLink = (storeSlug) => {
        const url = `${window.location.origin}/s/${storeSlug}`;
        navigator.clipboard.writeText(url);
        toast({
          title: "Lien copié !",
          description: "Le lien de la boutique a été copié dans le presse-papiers.",
        });
      };

      const getCurrencySymbol = (currency) => {
        switch (currency) {
          case 'EUR': return '€';
          case 'USD': return '$';
          case 'XOF': return 'CFA';
          default: return currency;
        }
      };
      
      if (loading || authLoading) {
        return <PageLoader />;
      }

      if (networkError) {
          return (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                    <Card className="w-full max-w-md p-8 bg-destructive/10 border-destructive">
                        <CardHeader className="p-0 mb-4">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
                                <WifiOff className="h-6 w-6 text-destructive" aria-hidden="true" />
                            </div>
                            <CardTitle className="mt-4 text-destructive">Erreur de Connexion au Serveur</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <p className="text-muted-foreground">
                                Impossible de communiquer avec nos serveurs. Cela peut être dû à un problème de connexion internet ou à une extension de votre navigateur (comme un bloqueur de publicité) qui interfère.
                            </p>
                            <Button className="mt-6" onClick={() => window.location.reload()}>
                                Rafraîchir la page
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
          );
      }

      return (
        <>
          <CreateStoreWizard
            isOpen={isWizardOpen}
            setIsOpen={setIsWizardOpen}
            onStoreCreated={(newStore) => {
              fetchDashboardData();
              navigate(`/store/${newStore.id}/design`);
            }}
          />
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h1 className="text-4xl font-bold gradient-text mb-2">
                Tableau de Bord
              </h1>
              <p className="text-muted-foreground">
                Gérez vos boutiques e-commerce et suivez vos performances
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6 mb-8">
              <StatsCard title="Solde Retirable" value={`${stats.withdrawableBalance.toLocaleString()} ${getCurrencySymbol(mainCurrency)}`} icon={Wallet} color="from-teal-500 to-lime-500" delay={0.1} />
              <StatsCard title="Boutiques Actives" value={stats.totalStores} icon={Store} color="from-blue-500 to-cyan-500" delay={0.2} />
              <StatsCard title="Commandes Payées" value={stats.totalOrders} icon={ShoppingBag} color="from-green-500 to-emerald-500" delay={0.3} />
              <StatsCard title="Chiffre d'Affaires" value={`${stats.totalRevenue.toLocaleString()} ${getCurrencySymbol(mainCurrency)}`} icon={TrendingUp} color="from-purple-500 to-pink-500" delay={0.4} />
              <StatsCard title="Clients Uniques" value={stats.totalCustomers} icon={Users} color="from-orange-500 to-red-500" delay={0.5} />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-card rounded-2xl p-4 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-card-foreground">Mes Boutiques</h2>
                <Button
                  onClick={() => setIsWizardOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 neon-glow w-full sm:w-auto"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Créer une Boutique
                </Button>
              </div>

              {stores.length === 0 && !loading ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center animate-pulse-slow">
                    <Store className="w-12 h-12 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-card-foreground mb-2">Aucune boutique créée</h3>
                  <p className="text-muted-foreground mb-6">
                    Commencez par créer votre première boutique e-commerce.
                  </p>
                </motion.div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stores.map((store, index) => (
                      <StoreCard
                        key={store.id}
                        store={store}
                        isSubscriptionActive={isSubscriptionActive}
                        onView={() => viewStore(store.slug)}
                        onEdit={() => editStore(store.id)}
                        onDelete={() => deleteStore(store.id)}
                        onCopyLink={() => copyStoreLink(store.slug)}
                        delay={index * 0.1}
                      />
                    ))}
                  </div>
                  <DataTablePagination
                    page={currentPage}
                    total={totalStores}
                    perPage={STORES_PER_PAGE}
                    onPageChange={setCurrentPage}
                  />
                </>
              )}
            </motion.div>
          </div>
        </>
      );
    }