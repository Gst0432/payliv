import React, { useState, useEffect, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { X, Loader2, ShoppingCart, Truck, CreditCard } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { v4 as uuidv4 } from 'uuid';
    import { PhoneInput } from "@/components/ui/phone-input";
    import MobileMoneyLogos from '@/components/MobileMoneyLogos';

    const CustomerInfoForm = ({ cart, store, total, onClose, clearCart, countryCode }) => {
      const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '', city: 'Abidjan' });
      const [isProcessing, setIsProcessing] = useState(false);
      const { toast } = useToast();

      const { showCOD, showApiWeb } = useMemo(() => {
        const hasDigital = cart.some(item => item.product_type === 'digital');
        const hasOnlyPhysical = cart.length > 0 && cart.every(item => item.product_type === 'physical');

        if (hasDigital) {
          return { showCOD: false, showApiWeb: store?.settings?.payments?.apiweb_enabled };
        }
        
        if (hasOnlyPhysical) {
          return { showCOD: true, showApiWeb: false };
        }

        return { showCOD: false, showApiWeb: false };
      }, [cart, store]);

      const handleInfoChange = (e) => {
        const { name, value } = e.target;
        setCustomerInfo(prev => ({ ...prev, [name]: value }));
      };
      
      const handlePhoneChange = (value) => {
        setCustomerInfo(prev => ({...prev, phone: value}));
      }

      const createOrder = async (paymentMethod) => {
        const orderId = uuidv4();
        const { data: insertedOrder, error } = await supabase.from('orders').insert({
          id: orderId,
          store_id: store.id,
          customer: customerInfo,
          items: cart,
          total,
          currency: store.settings?.currency || 'XOF',
          status: paymentMethod === 'cod' ? 'pending' : 'unpaid',
          payment_method: paymentMethod,
          customer_country_code: countryCode,
          has_digital: cart.some(item => item.product_type === 'digital'),
          has_physical: cart.some(item => item.product_type === 'physical'),
        }).select().single();

        if (error) throw error;
        return insertedOrder;
      }

      const handleCODPayment = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
          const order = await createOrder('cod');
          toast({
            title: 'Commande confirmée ! 🎉',
            description: 'Votre commande a été passée avec succès. Le vendeur vous contactera pour la livraison.',
          });
          clearCart();
          onClose();
        } catch (error) {
          toast({ title: "Erreur", description: "Impossible de passer la commande. " + error.message, variant: "destructive" });
        } finally {
          setIsProcessing(false);
        }
      };

      const initiateOnlinePayment = async () => {
        setIsProcessing(true);
        try {
          const order = await createOrder('apiweb');
          
          const articlesObject = cart.reduce((acc, item) => {
            acc[item.name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 40)] = item.price * item.quantity;
            return acc;
          }, {});

          const paymentPayload = {
              totalPrice: total,
              article: [articlesObject],
              personal_Info: [{ orderId: order.id, storeId: store.id, email: customerInfo.email }],
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
            console.error("API Web Response:", data);
            throw new Error(data.message || "L'URL de paiement n'a pas été retournée.");
          }
        } catch (error) {
          toast({ title: "Erreur de paiement", description: error.message, variant: 'destructive' });
          setIsProcessing(false);
        }
      };
      
      const handleSubmit = (e) => {
        e.preventDefault();
        if(showApiWeb) {
            initiateOnlinePayment();
        } else if (showCOD) {
            handleCODPayment(e);
        }
      }

      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" name="name" value={customerInfo.name} onChange={handleInfoChange} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">Adresse E-mail</Label>
            <Input id="email" name="email" type="email" value={customerInfo.email} onChange={handleInfoChange} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="phone">Numéro de téléphone</Label>
             <PhoneInput id="phone" value={customerInfo.phone} onChange={handlePhoneChange} defaultCountry={countryCode} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="city">Ville de livraison</Label>
            <Input id="city" name="city" value={customerInfo.city} onChange={handleInfoChange} required className="mt-1" />
          </div>
          <div className="!mt-6 space-y-3">
             {showCOD && (
              <Button type="submit" disabled={isProcessing} className="w-full h-12 text-lg">
                {isProcessing ? <Loader2 className="animate-spin w-6 h-6 mr-2" /> : <Truck className="w-6 h-6 mr-2" />}
                Commander (Paiement à la livraison)
              </Button>
            )}

            {showApiWeb && (
                <div>
                    <Button type="button" onClick={initiateOnlinePayment} disabled={isProcessing} className="w-full h-12 text-lg">
                        {isProcessing ? <Loader2 className="animate-spin w-6 h-6 mr-2" /> : <CreditCard className="w-6 h-6 mr-2" />}
                        Payer en ligne
                    </Button>
                    <MobileMoneyLogos />
                </div>
            )}
          </div>
        </form>
      );
    };

    const OrderModal = ({ isOpen, onClose, cart, store, total, clearCart, countryCode }) => {
      if (!isOpen) return null;

      const currency = store.settings?.currency || 'XOF';
      
      return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-card w-full max-w-md rounded-2xl shadow-xl relative overflow-hidden"
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-center mb-1 text-foreground">Votre commande</h2>
              <p className="text-center text-muted-foreground mb-4">Confirmez vos informations pour finaliser.</p>
              
              <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center mb-6">
                <span className="text-lg font-medium flex items-center"><ShoppingCart className="w-5 h-5 mr-2"/>Total</span>
                <span className="text-2xl font-bold">{total.toLocaleString()} {currency}</span>
              </div>
              
              <CustomerInfoForm cart={cart} store={store} total={total} onClose={onClose} clearCart={clearCart} countryCode={countryCode} />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4">
              <X className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      );
    };

    export default OrderModal;