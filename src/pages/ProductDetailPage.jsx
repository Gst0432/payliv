import React, { useState, useEffect, useCallback } from 'react';
    import { useParams, Link, useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Helmet } from 'react-helmet-async';
    import PageLoader from '@/components/PageLoader';
    import StoreHeader from '@/components/store/preview/StoreHeader';
    import StoreFooter from '@/components/store/StoreFooter';
    import SimilarProducts from '@/components/SimilarProducts';
    import OwnerTools from '@/components/store/preview/OwnerTools';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { ShoppingCart, ArrowLeft, Image as ImageIcon, CreditCard, Truck } from 'lucide-react';
    import OrderModal from '@/components/OrderModal';
    import { Badge } from '@/components/ui/badge';
    import ReactMarkdown from 'react-markdown';
    import remarkGfm from 'remark-gfm';
    import { getContrastingTextColor } from '@/lib/utils';
    import MobilePurchaseBar from '@/components/MobilePurchaseBar';
    import MobileMoneyLogos from '@/components/MobileMoneyLogos';

    export default function ProductDetailPage() {
      const { storeSlug, productId } = useParams();
      const { user } = useAuth();
      const { toast } = useToast();
      const navigate = useNavigate();

      const [store, setStore] = useState(null);
      const [product, setProduct] = useState(null);
      const [productImages, setProductImages] = useState([]);
      const [mainImage, setMainImage] = useState('');
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
      const [countryCode, setCountryCode] = useState('CI');
      
      const isOwner = user && store && user.id === store.user_id;

      const logVisit = useCallback(async (storeId, prodId) => {
        const { data } = await supabase.functions.invoke('log-store-visit', {
          body: { store_id: storeId, product_id: prodId },
        });
        if (data?.country_code) {
          setCountryCode(data.country_code);
        }
      }, []);

      useEffect(() => {
        const fetchProductData = async () => {
          setLoading(true);
          setError(null);
          
          const { data: storeData, error: storeError } = await supabase
            .from('stores')
            .select('*')
            .eq('slug', storeSlug)
            .eq('status', 'published')
            .single();
          
          if (storeError || !storeData) {
            setError('Boutique non trouvée ou indisponible.');
            setLoading(false);
            return;
          }
          setStore(storeData);

          const { data: productData, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('store_id', storeData.id)
            .single();

          if (productError || !productData) {
            setError('Produit non trouvé.');
            setLoading(false);
            return;
          }
          setProduct(productData);

          const { data: imagesData, error: imagesError } = await supabase
            .from('products_images')
            .select('url')
            .eq('product_id', productData.id)
            .order('created_at', { ascending: true });
          
          if (imagesError) console.error("Erreur de chargement des images du produit:", imagesError);
          
          const allImages = [productData.image, ...(imagesData?.map(i => i.url) || [])].filter(Boolean);
          setProductImages(allImages);
          setMainImage(allImages[0] || '');

          setLoading(false);
          logVisit(storeData.id, productData.id);
        };

        fetchProductData();
      }, [storeSlug, productId, toast, logVisit]);

      const handleDigitalPurchase = () => {
        if (!store?.settings?.payments?.apiweb_enabled) {
          toast({
            title: "Paiement indisponible",
            description: "Le paiement en ligne n'est pas activé pour cette boutique.",
            variant: "destructive"
          });
          return;
        }
        navigate(`/checkout/${product.id}`);
      };

      const handlePhysicalOrder = () => {
        setIsOrderModalOpen(true);
      };
      
      if (loading) return <PageLoader />;
      if (error) return (
        <div className="flex items-center justify-center h-screen text-center bg-background">
          <div>
            <h1 className="text-4xl font-bold text-destructive">Erreur</h1>
            <p className="mt-4 text-lg text-muted-foreground">{error}</p>
          </div>
        </div>
      );

      const pageTitle = product?.name || 'Détail du produit';
      const pageDescription = product?.description?.substring(0, 160) || `Découvrez ${product?.name} sur la boutique ${store?.name}.`;
      const ogImage = mainImage || store?.logo || 'https://storage.googleapis.com/hostinger-horizons-assets-prod/f45ec920-5a38-4fed-b465-6d4a9876f706/adc0bd1dfcc65ced231e230f282d5f14.png';
      const pageUrl = `${window.location.origin}/s/${storeSlug}/product/${productId}`;
      const primaryColor = store?.theme?.primaryColor || '#FBBF24';

      const cart = [{ ...product, quantity: 1 }];
      const total = product.price;

      return (
        <>
          <Helmet>
            <title>{`${pageTitle} - ${store?.name}`}</title>
            <meta name="description" content={pageDescription} />
            <meta property="og:title" content={`${pageTitle} - ${store?.name}`} />
            <meta property="og:description" content={pageDescription} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:url" content={pageUrl} />
            <meta name="twitter:card" content="summary_large_image" />
          </Helmet>

          <div className="min-h-screen bg-background text-foreground flex flex-col pb-24 md:pb-0">
            <AnimatePresence>{isOwner && <OwnerTools storeId={store.id} />}</AnimatePresence>
            <StoreHeader store={store} />
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <Link to={`/s/${storeSlug}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-8">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour à la boutique
                </Link>
              </motion.div>

              <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
                <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
                  <div className="aspect-square w-full bg-muted/20 rounded-2xl overflow-hidden shadow-lg mb-4">
                    {mainImage ? (
                      <img src={mainImage} alt={product.name} className="w-full h-full object-cover"/>
                    ) : (
                       <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-24 h-24 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {productImages.map((img, index) => (
                      <button key={index} onClick={() => setMainImage(img)} className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${mainImage === img ? 'border-primary' : 'border-transparent'}`}>
                        <img src={img} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover"/>
                      </button>
                    ))}
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                  {product.category && <Badge variant="secondary" className="mb-2">{product.category}</Badge>}
                  <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">{product.name}</h1>
                  <p className="text-4xl font-bold mb-6" style={{color: primaryColor}}>
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: store.settings?.currency || 'XOF' }).format(product.price)}
                  </p>
                  
                  <div className="prose prose-lg dark:prose-invert max-w-none text-muted-foreground mb-8">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{product.description}</ReactMarkdown>
                  </div>
                  
                  <div className="hidden md:block space-y-4">
                    {product.product_type === 'digital' && store?.settings?.payments?.apiweb_enabled &&
                      <div>
                        <Button onClick={handleDigitalPurchase} size="lg" className="w-full h-14 text-lg" style={{ backgroundColor: primaryColor, color: getContrastingTextColor(primaryColor) }}>
                          <CreditCard className="w-6 h-6 mr-3" />
                          Acheter maintenant
                        </Button>
                        <MobileMoneyLogos />
                      </div>
                    }
                    {product.product_type === 'physical' &&
                      <Button onClick={handlePhysicalOrder} size="lg" className="w-full h-14 text-lg" style={{ backgroundColor: primaryColor, color: getContrastingTextColor(primaryColor) }}>
                        <Truck className="w-6 h-6 mr-3" />
                        Commander (Paiement à la livraison)
                      </Button>
                    }
                  </div>
                </motion.div>
              </div>
              
              <SimilarProducts storeId={store.id} currentProductId={product.id} />
            </main>
            
            <StoreFooter store={store} />

            <MobilePurchaseBar
              product={product}
              store={store}
              onOrder={product.product_type === 'digital' ? handleDigitalPurchase : handlePhysicalOrder}
            />

            {product.product_type === 'physical' && (
              <OrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                cart={cart}
                store={store}
                total={total}
                clearCart={() => {}}
                countryCode={countryCode}
              />
            )}
          </div>
        </>
      );
    }