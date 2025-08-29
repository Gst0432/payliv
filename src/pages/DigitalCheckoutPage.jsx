import React, { useState, useEffect, useMemo } from 'react';
    import { useParams, useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Helmet } from 'react-helmet-async';
    import { motion } from 'framer-motion';
    import { v4 as uuidv4 } from 'uuid';
    import PageLoader from '@/components/PageLoader';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { PhoneInput } from '@/components/ui/phone-input';
    import { Loader2, CreditCard } from 'lucide-react';
    import MobileMoneyLogos from '@/components/MobileMoneyLogos';

    export default function DigitalCheckoutPage() {
      const { orderId: productId } = useParams();
      const navigate = useNavigate();
      const { toast } = useToast();

      const [product, setProduct] = useState(null);
      const [store, setStore] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '' });
      const [isProcessing, setIsProcessing] = useState(false);
      const [countryCode, setCountryCode] = useState('CI');
      
      useEffect(() => {
        const fetchGeo = async () => {
          try {
            const { data } = await supabase.functions.invoke('get-geo-data');
            if (data?.country_code) {
              setCountryCode(data.country_code);
            }
          } catch (e) {
            console.warn("Could not fetch geo data:", e);
          }
        }
        fetchGeo();
      }, []);

      useEffect(() => {
        const fetchProduct = async () => {
          setLoading(true);
          const { data: productData, error: productError } = await supabase
            .from('products')
            .select('*, store:store_id(*)')
            .eq('id', productId)
            .single();
          
          if (productError || !productData) {
            setError("Produit non trouvé ou indisponible.");
            toast({ title: 'Erreur', description: 'Produit non trouvé.', variant: 'destructive' });
            navigate('/marketplace');
          } else if (productData.product_type !== 'digital') {
            setError("Cette page est réservée aux produits digitaux.");
            toast({ title: 'Erreur', description: 'Ce produit n\'est pas digital.', variant: 'destructive' });
            navigate(`/s/${productData.store.slug}/product/${productData.id}`);
          }
          else {
            setProduct(productData);
            setStore(productData.store);
          }
          setLoading(false);
        };
        fetchProduct();
      }, [productId, navigate, toast]);

      const handleInfoChange = (e) => {
        const { name, value } = e.target;
        setCustomerInfo(prev => ({ ...prev, [name]: value }));
      };
      
      const handlePhoneChange = (value) => {
        setCustomerInfo(prev => ({ ...prev, phone: value }));
      };
      
      const handlePayment = async (e) => {
        e.preventDefault();
        setIsProcessing(true);

        const useApiWeb = store?.settings?.payments?.apiweb_enabled;

        if (!useApiWeb) {
            toast({ title: "Paiement indisponible", description: "Ce service de paiement n'est pas activé pour cette boutique.", variant: 'destructive' });
            setIsProcessing(false);
            return;
        }

        const orderId = uuidv4();
        const cart = [{ ...product, quantity: 1, name: product.name, price: product.price, product_id: product.id }];
        const total = product.price;

        try {
            const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert({
                id: orderId,
                store_id: store.id,
                customer: customerInfo,
                items: cart,
                total: total,
                currency: store.settings?.currency || 'XOF',
                status: 'unpaid',
                payment_method: 'apiweb',
                customer_country_code: countryCode,
                has_digital: true,
                has_physical: false,
            }).select().single();

            if (orderError) throw orderError;
            
            const paymentPayload = {
                totalPrice: product.price,
                article: [ { [product.name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 40)]: product.price } ],
                personal_Info: [{ orderId: insertedOrder.id, storeId: store.id }],
                numeroSend: customerInfo.phone.trim(),
                nomclient: customerInfo.name.trim(),
                return_url: `${window.location.origin}/payment-status`
            };
    
            const { data, error } = await supabase.functions.invoke('apiweb-api', { body: paymentPayload });
            
            if (error) {
                throw new Error(error.message);
            } else if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("FusionPay API Response:", data);
                throw new Error(data.message || "L'URL de paiement FusionPay n'a pas été retournée.");
            }

        } catch (error) {
            toast({ title: "Erreur de paiement", description: error.message, variant: 'destructive' });
            setIsProcessing(false);
        }
      };

      if (loading) return <PageLoader />;
      if (error) return <div className="text-center p-8 text-destructive">{error}</div>;

      return (
        <>
          <Helmet>
            <title>Paiement pour {product.name}</title>
          </Helmet>
          <div className="min-h-screen bg-muted flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg">
              <div className="bg-card p-6 sm:p-8 rounded-xl shadow-2xl">
                <div className="text-center mb-6">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Finaliser votre achat</h1>
                  <p className="text-muted-foreground">Vous êtes sur le point d'acheter :</p>
                  <p className="font-semibold text-lg text-primary mt-1">{product.name}</p>
                </div>
                
                <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center mb-6">
                    <span className="text-lg font-medium">Total à payer :</span>
                    <span className="text-2xl font-bold">{product.price.toLocaleString()} {store.settings?.currency || 'XOF'}</span>
                </div>

                <form onSubmit={handlePayment} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nom complet</Label>
                    <Input id="name" name="name" value={customerInfo.name} onChange={handleInfoChange} required className="mt-1 bg-background" />
                  </div>
                  <div>
                    <Label htmlFor="email">Adresse e-mail</Label>
                    <Input id="email" name="email" type="email" value={customerInfo.email} onChange={handleInfoChange} required className="mt-1 bg-background" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Numéro de téléphone</Label>
                    <PhoneInput id="phone" value={customerInfo.phone} onChange={handlePhoneChange} defaultCountry={countryCode} required className="mt-1" />
                  </div>
                  
                  <div className="pt-4">
                    <Button type="submit" disabled={isProcessing} className="w-full h-12 text-lg">
                      {isProcessing ? <Loader2 className="animate-spin w-6 h-6 mr-2" /> : <CreditCard className="w-6 h-6 mr-2" />}
                      Payer par Mobile Money
                    </Button>
                    <MobileMoneyLogos />
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </>
      );
    }