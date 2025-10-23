'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonCard, IonCardContent, IonItem, IonLabel, IonText, IonButton, IonSpinner, IonRefresher, IonRefresherContent, IonGrid, IonRow, IonCol, IonSearchbar, IonSelect, IonSelectOption, IonChip, IonBadge, IonIcon, IonFab, IonFabButton } from '@ionic/react'
import { add, search, filter, cart, download, eye, request } from 'ionicons/icons'
import { ApiResponse, Product, ProductCategory, ProductType } from '@/types'
import { formatCurrency } from '@/lib/utils'

export default function MarketplacePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (categoryFilter) params.append('category', categoryFilter)
      if (typeFilter) params.append('type', typeFilter)

      const response = await fetch(`/api/marketplace/products?${params}`)
      const result: ApiResponse<Product[]> = await response.json()

      if (result.success && result.data) {
        setProducts(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [searchTerm, categoryFilter, typeFilter])

  const handleRefresh = async (event: CustomEvent) => {
    await fetchProducts()
    event.detail.complete()
  }

  const handleProductClick = (product: Product) => {
    router.push(`/marketplace/products/${product.id}`)
  }

  const handleAddToCart = (product: Product) => {
    // TODO: Implement add to cart functionality
    console.log('Add to cart:', product)
  }

  const handleRequestProduct = () => {
    router.push('/marketplace/request')
  }

  const getCategoryColor = (category: ProductCategory) => {
    const colors: Record<ProductCategory, string> = {
      BOOKS: 'primary',
      UNIFORMS: 'secondary',
      STATIONERY: 'tertiary',
      ELECTRONICS: 'success',
      SPORTS: 'warning',
      FOOD: 'danger',
      TRANSPORT: 'medium',
      SERVICES: 'dark',
      DIGITAL: 'light',
      OTHER: 'medium',
    }
    return colors[category] || 'medium'
  }

  const getTypeIcon = (type: ProductType) => {
    switch (type) {
      case 'DIGITAL':
        return download
      case 'SERVICE':
        return request
      default:
        return eye
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Marketplace</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="ion-padding">
          {/* Search and Filters */}
          <IonCard>
            <IonCardContent>
              <IonSearchbar
                value={searchTerm}
                onIonInput={(e) => setSearchTerm(e.detail.value!)}
                placeholder="Search products..."
                showClearButton="focus"
              />
              
              <div className="flex gap-2 mt-4">
                <IonSelect
                  value={categoryFilter}
                  onSelectionChange={(e) => setCategoryFilter(e.detail.value)}
                  placeholder="All Categories"
                  interface="popover"
                >
                  <IonSelectOption value="">All Categories</IonSelectOption>
                  <IonSelectOption value="BOOKS">Books</IonSelectOption>
                  <IonSelectOption value="UNIFORMS">Uniforms</IonSelectOption>
                  <IonSelectOption value="STATIONERY">Stationery</IonSelectOption>
                  <IonSelectOption value="ELECTRONICS">Electronics</IonSelectOption>
                  <IonSelectOption value="SPORTS">Sports</IonSelectOption>
                  <IonSelectOption value="FOOD">Food</IonSelectOption>
                  <IonSelectOption value="TRANSPORT">Transport</IonSelectOption>
                  <IonSelectOption value="SERVICES">Services</IonSelectOption>
                  <IonSelectOption value="DIGITAL">Digital</IonSelectOption>
                  <IonSelectOption value="OTHER">Other</IonSelectOption>
                </IonSelect>

                <IonSelect
                  value={typeFilter}
                  onSelectionChange={(e) => setTypeFilter(e.detail.value)}
                  placeholder="All Types"
                  interface="popover"
                >
                  <IonSelectOption value="">All Types</IonSelectOption>
                  <IonSelectOption value="PHYSICAL">Physical</IonSelectOption>
                  <IonSelectOption value="DIGITAL">Digital</IonSelectOption>
                  <IonSelectOption value="SERVICE">Service</IonSelectOption>
                </IonSelect>
              </div>
            </IonCardContent>
          </IonCard>

          {/* Products Grid */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <IonSpinner name="crescent" />
            </div>
          ) : (
            <IonGrid>
              <IonRow>
                {products.map((product) => (
                  <IonCol size="12" sizeMd="6" sizeLg="4" key={product.id}>
                    <IonCard button onClick={() => handleProductClick(product)}>
                      <IonCardContent>
                        {/* Product Image */}
                        {product.imageUrl && (
                          <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 flex items-center justify-center">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        )}

                        {/* Product Info */}
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                            {product.name}
                          </h3>
                          
                          {product.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {product.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between">
                            <span className="text-xl font-bold text-primary">
                              {formatCurrency(product.price)}
                            </span>
                            <IonChip color={getCategoryColor(product.category)}>
                              {product.category}
                            </IonChip>
                          </div>

                          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <IonIcon icon={getTypeIcon(product.type)} size="small" />
                              <span>{product.type}</span>
                            </div>
                            
                            {product.stock > 0 ? (
                              <span className="text-green-600">
                                {product.stock} in stock
                              </span>
                            ) : (
                              <span className="text-red-600">Out of stock</span>
                            )}
                          </div>

                          {/* Tags */}
                          {product.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {product.tags.slice(0, 3).map((tag, index) => (
                                <IonChip key={index} color="light" size="small">
                                  {tag}
                                </IonChip>
                              ))}
                              {product.tags.length > 3 && (
                                <IonChip color="light" size="small">
                                  +{product.tags.length - 3}
                                </IonChip>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-4">
                            {product.stock > 0 ? (
                              <IonButton
                                size="small"
                                expand="block"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddToCart(product)
                                }}
                              >
                                <IonIcon icon={cart} slot="start" />
                                Add to Cart
                              </IonButton>
                            ) : (
                              <IonButton
                                size="small"
                                expand="block"
                                fill="outline"
                                disabled
                              >
                                Out of Stock
                              </IonButton>
                            )}
                          </div>
                        </div>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                ))}
              </IonRow>

              {products.length === 0 && (
                <IonRow>
                  <IonCol size="12">
                    <IonCard>
                      <IonCardContent className="text-center py-12">
                        <IonIcon icon={search} size="large" color="medium" className="mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          No Products Found
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Try adjusting your search or filters
                        </p>
                        <IonButton onClick={handleRequestProduct}>
                          <IonIcon icon={request} slot="start" />
                          Request Product
                        </IonButton>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                </IonRow>
              )}
            </IonGrid>
          )}
        </div>

        {/* Floating Action Buttons */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={handleRequestProduct}>
            <IonIcon icon={request} />
          </IonFabButton>
        </IonFab>
      </IonContent>
    </IonPage>
  )
}