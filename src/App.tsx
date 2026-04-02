/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Info, 
  ChevronRight, 
  CheckCircle2, 
  Camera,
  Navigation,
  AlertCircle,
  ChevronDown,
  MessageSquare,
  LayoutDashboard,
  List,
  Search,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Send,
  User,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useJsApiLoader } from '@react-google-maps/api';
import { format } from 'date-fns';
import DaumPostcode from 'react-daum-postcode';
import { cn } from '@/src/lib/utils';
import { TONNAGES, VEHICLE_BODIES, calculateFare, type Tonnage, type VehicleBody } from '@/src/types';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  getDocs,
  limit
} from 'firebase/firestore';

const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

// Address Search Modal Component
const PostcodeModal = ({ 
  isOpen, 
  onClose, 
  onComplete 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onComplete: (address: string) => void; 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border-4 border-blue-900"
      >
        <div className="p-4 border-b-4 border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="font-black text-xl text-blue-900">주소 검색</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <AlertCircle className="w-6 h-6 text-gray-500 rotate-45" />
          </button>
        </div>
        <div className="h-[450px]">
          <DaumPostcode
            onComplete={(data) => {
              const fullAddress = data.roadAddress || data.address;
              onComplete(fullAddress);
              onClose();
            }}
            style={{ height: '100%' }}
          />
        </div>
      </motion.div>
    </div>
  );
};

// Chat Window Component
const ChatWindow = ({ quoteId, senderType }: { quoteId: string, senderType: 'user' | 'admin' }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!quoteId) return;
    const q = query(
      collection(db, 'quotes', quoteId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [quoteId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !quoteId) return;

    try {
      await addDoc(collection(db, 'quotes', quoteId, 'messages'), {
        text: newMessage,
        sender: senderType,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden border-2 border-gray-200">
      <div className="bg-gray-50 p-3 border-b-2 border-gray-200 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-blue-900" />
        <span className="font-black text-sm text-blue-900">실시간 채팅 상담</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px] bg-gray-50/50"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs font-bold text-gray-400">문의 사항을 남겨주시면 관리자가 확인 후 답변드립니다.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.sender === senderType ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm font-bold shadow-sm",
                msg.sender === senderType 
                  ? "bg-blue-900 text-white rounded-tr-none" 
                  : "bg-white border-2 border-gray-200 text-gray-900 rounded-tl-none"
              )}>
                {msg.text}
              </div>
              <span className="text-[10px] text-gray-400 mt-1 font-bold">
                {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t-2 border-gray-200 flex gap-2">
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-900 outline-none"
        />
        <button 
          type="submit"
          className="bg-blue-900 text-white p-2 rounded-xl hover:bg-blue-800 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

// Admin Dashboard Component
const AdminDashboard = ({ onBack }: { onBack: () => void }) => {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuotes(data);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-blue-900 font-black mb-2 hover:underline"
            >
              <ArrowLeft className="w-5 h-5" />
              메인으로 돌아가기
            </button>
            <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
              <LayoutDashboard className="w-8 h-8 text-blue-900" />
              관리자 대시보드
            </h1>
            <p className="text-gray-500 font-bold">최근 견적 신청 내역 (실시간 업데이트)</p>
          </div>
        </div>

        {error ? (
          <div className="bg-red-100 border-4 border-red-300 p-6 rounded-3xl text-red-800 font-black flex items-center gap-4">
            <AlertCircle className="w-8 h-8" />
            {error}
          </div>
        ) : loading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="w-12 h-12 text-blue-900 animate-spin" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="bg-white border-4 border-gray-200 p-12 rounded-3xl text-center">
            <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-xl font-black text-gray-400">아직 접수된 견적이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {quotes.map((quote) => (
                <motion.div 
                  key={quote.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedQuoteId(quote.id)}
                  className={cn(
                    "bg-white border-4 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all cursor-pointer",
                    selectedQuoteId === quote.id ? "border-blue-900 ring-4 ring-blue-100" : "border-gray-900"
                  )}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="bg-blue-900 text-white px-4 py-1 rounded-full text-xs font-black">
                          {quote.createdAt?.toDate ? format(quote.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : ''}
                        </span>
                        <span className="text-blue-900 font-black text-lg">
                          {quote.estimatedFare?.toLocaleString()}원
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                              <div className="w-2 h-2 bg-blue-900 rounded-full" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase">출발지</p>
                              <p className="font-black text-gray-900">{quote.origin}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                              <div className="w-2 h-2 bg-red-600 rounded-full" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase">도착지</p>
                              <p className="font-black text-gray-900">{quote.destination}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-100 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-gray-500">차량 정보</span>
                            <span className="font-black text-blue-900">{quote.tonnage} / {quote.vehicleBody}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-gray-500">화물 내용</span>
                            <span className="font-black text-gray-900">{quote.cargoDetails || '없음'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-gray-500">고객 연락처</span>
                            <a href={`tel:${quote.contact}`} className="font-black text-blue-600 underline flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {quote.contact}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-8 space-y-4">
                <div className="bg-white border-4 border-blue-900 rounded-3xl p-6 shadow-2xl">
                  <h3 className="font-black text-xl text-blue-900 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-6 h-6" />
                    실시간 상담 채팅
                  </h3>
                  {selectedQuoteId ? (
                    <div className="h-[500px]">
                      <ChatWindow quoteId={selectedQuoteId} senderType="admin" />
                    </div>
                  ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center text-center p-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                      <MessageSquare className="w-12 h-12 text-gray-300 mb-4" />
                      <p className="text-gray-400 font-bold">왼쪽 리스트에서 견적을 선택하면 채팅창이 활성화됩니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Stable Address Input Component
const AddressInput = ({ 
  value, 
  onClick,
  placeholder,
  iconColor
}: {
  value: string;
  onClick: () => void;
  placeholder: string;
  iconColor: string;
}) => {
  return (
    <div className="relative w-full group cursor-pointer" onClick={onClick}>
      <MapPin className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 z-10", iconColor)} />
      <div className="w-full pl-12 pr-4 py-4 bg-white border-4 border-gray-600 rounded-2xl font-black text-gray-900 text-lg min-h-[64px] flex items-center shadow-sm group-hover:border-blue-700 transition-colors">
        {value ? (
          <span className="truncate">{value}</span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-blue-100 text-blue-900 px-3 py-1 rounded-lg text-xs font-black border-2 border-blue-900">
        검색
      </div>
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState(1);
  const [isAdminView, setIsAdminView] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
  const [contact, setContact] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('14:00');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [cargoDetails, setCargoDetails] = useState('');
  const [tonnage, setTonnage] = useState<Tonnage>('1t');
  const [vehicleBody, setVehicleBody] = useState<VehicleBody>('cargo');
  
  const [distance, setDistance] = useState<number | null>(null);
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);
  const [postcodeTarget, setPostcodeTarget] = useState<'origin' | 'destination' | null>(null);

  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const rawApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const googleMapsApiKey = rawApiKey.trim();

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries: LIBRARIES,
    language: 'ko',
    region: 'KR'
  });

  const loadingRef = useRef(false);

  useEffect(() => {
    if (loadError) {
      console.error('Google Maps Load Error:', loadError);
      if (loadError.message.includes('ApiTargetBlockedMapError')) {
        setError('구글 지도 API 키 제한 오류가 발생했습니다. 아래 [해결 방법]을 확인해 주세요.');
      } else {
        setError(`지도 서비스를 불러오지 못했습니다: ${loadError.message}`);
      }
    }
  }, [loadError]);

  const handleCalculate = async () => {
    if (!origin || !destination) {
      setError('출발지와 도착지를 입력해주세요.');
      return;
    }
    if (!contact) {
      setError('연락처를 입력해주세요.');
      return;
    }

    const rawKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : '';
    
    if (!apiKey) {
      setError('구글 지도 API 키가 설정되지 않았습니다. AI Studio 비밀(Secrets) 설정에서 VITE_GOOGLE_MAPS_API_KEY를 확인해 주세요.');
      setIsLoading(false);
      loadingRef.current = false;
      return;
    }
    
    const statusInfo = `Key: ${apiKey.substring(0, 5)}... (Len: ${apiKey.length}), Loaded: ${isLoaded}, Error: ${loadError ? loadError.message : 'null'}, Google: ${typeof google !== 'undefined'}`;
    setDebugInfo(statusInfo);
    
    console.log('API Key Status:', { 
      length: apiKey.length, 
      prefix: apiKey.substring(0, 5),
      isLoaded,
      hasGoogle: typeof google !== 'undefined'
    });

    setIsLoading(true);
    loadingRef.current = true;
    setError(null);

    const timeoutId = setTimeout(() => {
      if (loadingRef.current) {
        loadingRef.current = false;
        setIsLoading(false);
        setError('구글 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요. (API 설정 적용 중일 수 있습니다)');
      }
    }, 40000);

    try {
      if (typeof google === 'undefined' || !google.maps) {
        throw new Error('GOOGLE_NOT_LOADED');
      }

      const geocoder = new google.maps.Geocoder();
      const service = new google.maps.DistanceMatrixService();

      // Helper: Geocode with retry and simplification
      const smartGeocode = async (address: string): Promise<google.maps.LatLng> => {
        const clean = (a: string) => a.replace(/\(.*\)/g, '').split(',')[0].trim();
        const attempts = [
          `대한민국 ${clean(address)}`,
          clean(address),
          clean(address).split(' ').slice(0, 4).join(' '), // Dong/Eup/Myeon level
          clean(address).split(' ').slice(0, 3).join(' ')  // Gu/Gun level
        ];

        for (let i = 0; i < attempts.length; i++) {
          try {
            const addr = attempts[i];
            console.log(`[DEBUG] Geocoding attempt ${i + 1}: ${addr}`);
            const result = await new Promise<google.maps.LatLng>((resolve, reject) => {
              geocoder.geocode({ address: addr, region: 'KR' }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                  resolve(results[0].geometry.location);
                } else {
                  reject(new Error(status));
                }
              });
            });
            return result;
          } catch (e: any) {
            if (i === attempts.length - 1) throw e;
            console.warn(`[DEBUG] Attempt ${i + 1} failed, trying next...`);
          }
        }
        throw new Error('UNKNOWN_GEO_FAILURE');
      };

      try {
        console.log('Step 1: Geocoding Origin');
        const originLatLng = await smartGeocode(origin);
        
        console.log('Step 2: Geocoding Destination');
        const destLatLng = await smartGeocode(destination);

        console.log('Step 3: Calculating Distance');
        service.getDistanceMatrix(
          {
            origins: [originLatLng],
            destinations: [destLatLng],
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (response, status) => {
            if (!loadingRef.current) return;
            clearTimeout(timeoutId);
            loadingRef.current = false;

            if (status === 'OK' && response) {
              const element = response.rows[0].elements[0];
              if (element.status === 'OK') {
                const distKm = element.distance.value / 1000;
                const fare = calculateFare(distKm, tonnage, vehicleBody);
                setDistance(distKm);
                setEstimatedFare(fare);
                setStep(2);
                triggerAdminNotification(distKm, fare);
              } else {
                // Final Fallback: Straight line
                const straightDist = google.maps.geometry.spherical.computeDistanceBetween(originLatLng, destLatLng) / 1000;
                const approxRoadDist = straightDist * 1.4;
                const fare = calculateFare(approxRoadDist, tonnage, vehicleBody);
                setDistance(approxRoadDist);
                setEstimatedFare(fare);
                setStep(2);
                triggerAdminNotification(approxRoadDist, fare);
              }
            } else {
              setError(`거리 계산 실패 (상태: ${status}). API 설정을 다시 확인해 주세요.`);
            }
            setIsLoading(false);
          }
        );
      } catch (geoErr: any) {
        clearTimeout(timeoutId);
        loadingRef.current = false;
        setIsLoading(false);
        const status = geoErr.message;
        console.error('[DEBUG] Geocode Error:', status);
        
        if (status === 'REQUEST_DENIED') {
          setError('구글 API 접근이 거부되었습니다. API 키에 Geocoding API가 허용되어 있는지 확인해 주세요.');
        } else if (status === 'ZERO_RESULTS') {
          setError('입력하신 주소를 찾을 수 없습니다. 주소를 조금 더 간략하게 입력해 보세요.');
        } else {
          setError(`주소 확인 중 오류가 발생했습니다 (에러: ${status}). 잠시 후 다시 시도해 주세요.`);
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      loadingRef.current = false;
      console.error('Calculation Error:', err);
      setError('시스템 오류가 발생했습니다. 하단 전화 버튼으로 문의주시면 즉시 안내해드리겠습니다.');
      setIsLoading(false);
    }
  };

  const handleCall = () => {
    window.location.href = 'tel:1844-0324';
  };

  const triggerAdminNotification = async (dist: number, fare: number) => {
    const quoteData = {
      origin,
      destination,
      tonnage,
      vehicleBody,
      cargoDetails,
      contact,
      estimatedFare: fare,
      distance: dist,
      createdAt: serverTimestamp()
    };

    try {
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'quotes'), quoteData);
      setCurrentQuoteId(docRef.id);
      console.log('Quote saved to Firestore with ID:', docRef.id);

      // Silent background API call to our server for email notification
      await fetch('/api/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quoteData: { ...quoteData, createdAt: new Date().toISOString() } }),
      });
    } catch (error) {
      console.error('Failed to save quote or send notification:', error);
    }
  };

  const openPostcode = (target: 'origin' | 'destination') => {
    setPostcodeTarget(target);
    setIsPostcodeOpen(true);
  };

  if (isAdminView) {
    return <AdminDashboard onBack={() => setIsAdminView(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#FACC15] text-[#111827] font-sans">
      <PostcodeModal 
        isOpen={isPostcodeOpen}
        onClose={() => setIsPostcodeOpen(false)}
        onComplete={(address) => {
          if (postcodeTarget === 'origin') setOrigin(address);
          if (postcodeTarget === 'destination') setDestination(address);
        }}
      />

      {/* API Error Banner */}
      {loadError && (
        <div className="bg-red-100 border-b-4 border-red-400 p-4 text-center">
          <div className="max-w-xl mx-auto flex flex-col items-center justify-center gap-2 text-red-950 text-sm font-black">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>구글 지도 API 설정에 문제가 있습니다.</span>
            </div>
            <div className="bg-white/50 px-3 py-1 rounded font-mono text-[10px] break-all">
              {loadError.message}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b-8 border-blue-900 sticky top-0 z-50 shadow-xl">
        <div className="max-w-xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              const newCount = logoClickCount + 1;
              if (newCount >= 5) {
                setIsAdminView(true);
                setLogoClickCount(0);
              } else {
                setLogoClickCount(newCount);
              }
            }}
          >
            <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center shadow-2xl">
              <Truck className="text-white w-6 h-6" />
            </div>
            <span className="font-black text-2xl tracking-tighter">전국특송화물</span>
          </div>
          <button 
            onClick={handleCall}
            className="text-blue-900 font-black flex items-center gap-2 text-base bg-blue-100 px-5 py-2.5 rounded-full border-4 border-blue-900 shadow-md"
          >
            <Phone className="w-5 h-5" />
            1844-0324
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 pb-32">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <section className="px-1">
                <h2 className="text-3xl font-black mb-2 tracking-tight">간편 견적 신청</h2>
                <p className="text-gray-700 font-bold">정확한 정보를 입력하시면 예상 운임을 알려드립니다.</p>
              </section>

              {/* Contact & Schedule */}
              <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-gray-500 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-600 uppercase tracking-widest">연락처</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="tel" 
                      placeholder="010-0000-0000"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white border-4 border-gray-500 rounded-2xl focus:outline-none focus:border-blue-700 font-black text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-600 uppercase tracking-widest">운송 예정일</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input 
                        type="date" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white border-4 border-gray-500 rounded-2xl focus:outline-none focus:border-blue-700 font-black text-gray-900"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-600 uppercase tracking-widest">희망 시간</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input 
                        type="time" 
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white border-4 border-gray-500 rounded-2xl focus:outline-none focus:border-blue-700 font-black text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Route */}
              <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-gray-500 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-600 uppercase tracking-widest">출발지 검색</label>
                  <AddressInput 
                    value={origin}
                    onClick={() => openPostcode('origin')}
                    placeholder="출발 주소를 검색하세요"
                    iconColor="text-blue-800"
                  />
                </div>

                <div className="flex justify-center py-1">
                  <div className="w-full h-1 bg-gray-300 rounded-full" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-600 uppercase tracking-widest">도착지 검색</label>
                  <AddressInput 
                    value={destination}
                    onClick={() => openPostcode('destination')}
                    placeholder="도착 주소를 검색하세요"
                    iconColor="text-red-800"
                  />
                </div>
              </div>

              {/* Vehicle Selection */}
              <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-gray-400 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-600 uppercase tracking-widest">톤수 선택</label>
                    <div className="relative">
                      <select 
                        value={tonnage}
                        onChange={(e) => setTonnage(e.target.value as Tonnage)}
                        className="w-full pl-4 pr-10 py-3 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-blue-600 transition-all font-black appearance-none cursor-pointer text-gray-900"
                      >
                        {TONNAGES.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-gray-600 uppercase tracking-widest">차종 선택</label>
                    <div className="relative">
                      <select 
                        value={vehicleBody}
                        onChange={(e) => setVehicleBody(e.target.value as VehicleBody)}
                        className="w-full pl-4 pr-10 py-3 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-blue-600 transition-all font-black appearance-none cursor-pointer text-gray-900"
                      >
                        {VEHICLE_BODIES.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cargo Details */}
              <div className="bg-white p-6 rounded-3xl shadow-xl border-2 border-gray-400 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-600 uppercase tracking-widest">화물 내용</label>
                  <textarea 
                    placeholder="화물내용 및 부피, 수량 등을 기재해주세요..."
                    value={cargoDetails}
                    onChange={(e) => setCargoDetails(e.target.value)}
                    className="w-full p-4 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-blue-600 transition-all min-h-[120px] resize-none font-bold placeholder:text-gray-400 text-gray-900"
                  />
                </div>
                <button className="w-full py-4 border-2 border-dashed border-gray-400 rounded-xl text-gray-600 flex items-center justify-center gap-2 hover:bg-gray-100 transition-all bg-gray-50">
                  <Camera className="w-6 h-6" />
                  <span className="text-sm font-black">사진 첨부 (선택)</span>
                </button>
              </div>

              {error && (
                <div className="bg-red-100 text-red-800 p-6 rounded-2xl flex flex-col gap-3 border-4 border-red-300 font-bold shadow-lg">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 shrink-0" />
                    <span className="text-base">{error}</span>
                  </div>
                  
                  {error.includes('제한 오류') && (
                    <div className="mt-2 bg-white p-4 rounded-xl border-2 border-red-200 text-xs text-gray-700 space-y-2">
                      <p className="font-black text-red-600 underline">⚠️ 해결 방법 (구글 클라우드 콘솔):</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>구글 클라우드 콘솔의 <b>[사용자 인증 정보]</b>로 이동합니다.</li>
                        <li>사용 중인 API 키(VITE_GOOGLE_MAPS_API_KEY)를 클릭합니다.</li>
                        <li><b>[API 제한사항]</b> 섹션에서 <b>'키 제한 안함'</b>을 선택하거나,</li>
                        <li>제한을 유지하려면 아래 3개 API를 모두 체크해 주세요:
                          <ul className="list-disc list-inside ml-4 mt-1 font-black text-blue-700">
                            <li>Maps JavaScript API</li>
                            <li>Geocoding API</li>
                            <li>Distance Matrix API</li>
                          </ul>
                        </li>
                        <li><b>[저장]</b>을 누르고 1~2분 후 다시 시도해 주세요.</li>
                      </ol>
                    </div>
                  )}

                  {debugInfo && (
                    <div className="bg-white/50 p-2 rounded-lg font-mono text-[10px] text-red-500 break-all border border-red-200">
                      진단 정보: {debugInfo}
                    </div>
                  )}
                </div>
              )}

              <button 
                onClick={handleCalculate}
                disabled={isLoading}
                className="w-full bg-blue-800 text-white py-5 rounded-2xl font-black text-xl shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-blue-900"
              >
                {isLoading ? (
                  <div className="w-7 h-7 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    견적 알아보기
                    <ChevronRight className="w-6 h-6" />
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-300 shadow-inner">
                  <CheckCircle2 className="text-green-600 w-12 h-12" />
                </div>
                <h2 className="text-3xl font-black tracking-tight">예상 견적 확인</h2>
                <p className="text-gray-700 font-bold">입력하신 정보를 바탕으로 산출된 금액입니다.</p>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-gray-400">
                <div className="bg-blue-800 p-10 text-white text-center border-b-4 border-blue-950">
                  <p className="text-blue-200 text-sm font-black mb-2 tracking-widest uppercase">예상 운임</p>
                  <h3 className="text-5xl font-black tracking-tighter">{estimatedFare?.toLocaleString()}원</h3>
                  <div className="mt-6 inline-flex items-center gap-2 bg-white/20 px-5 py-2 rounded-full text-sm font-black border-2 border-white/30 backdrop-blur-sm">
                    <Navigation className="w-4 h-4" />
                    약 {distance?.toFixed(1)}km 이동
                  </div>
                </div>

                <div className="p-10 space-y-8">
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-black uppercase tracking-widest">선택 톤수</p>
                      <p className="font-black text-xl">{TONNAGES.find(t => t.id === tonnage)?.name}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-black uppercase tracking-widest">선택 차종</p>
                      <p className="font-black text-xl">{VEHICLE_BODIES.find(b => b.id === vehicleBody)?.name}</p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-300" />

                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="w-3 h-3 rounded-full bg-blue-700 mt-2 border-2 border-blue-200 shadow-sm" />
                      <div>
                        <p className="text-xs text-gray-500 font-black uppercase tracking-widest">출발지</p>
                        <p className="text-base font-black leading-relaxed">{origin}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-3 h-3 rounded-full bg-red-700 mt-2 border-2 border-red-200 shadow-sm" />
                      <div>
                        <p className="text-xs text-gray-500 font-black uppercase tracking-widest">도착지</p>
                        <p className="text-base font-black leading-relaxed">{destination}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-6 rounded-3xl flex gap-4 border-2 border-amber-200 shadow-inner">
                    <Info className="w-6 h-6 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-950 leading-relaxed font-bold">
                      상기 금액은 예상금액이며, 상세주소, 화물내용, 운송조건(경유/혼적, 운송시간대 및 지역)등에 따라 변동될 수 있으며 정확한 금액은 상담후 확인 가능하오니, 상담이 필요하시면 하단 버튼으로 문의주세요.
                    </p>
                  </div>

                  {/* Customer Chat Section */}
                  <div className="space-y-4">
                    <h4 className="font-black text-lg text-blue-900 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      화물 내용 관련 실시간 문의
                    </h4>
                    <div className="h-[350px]">
                      {currentQuoteId ? (
                        <ChatWindow quoteId={currentQuoteId} senderType="user" />
                      ) : (
                        <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={handleCall}
                  className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:bg-black"
                >
                  <Phone className="w-6 h-6" />
                  전화로 즉시 문의하기
                </button>

                <button 
                  onClick={() => setStep(1)}
                  className="w-full py-4 text-gray-500 font-black text-sm hover:text-gray-800 transition-all"
                >
                  처음으로 돌아가기
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16 px-4 border-t-8 border-blue-900">
        <div className="max-w-xl mx-auto space-y-8">
          <div className="flex items-center gap-3 text-white">
            <Truck className="w-8 h-8 text-blue-500" />
            <span className="font-black text-2xl tracking-tighter">(주)전국특송화물</span>
          </div>
          <div className="grid grid-cols-1 gap-5 text-sm leading-relaxed">
            <p className="font-bold text-gray-300">상호: (주)전국특송화물 | 전화: 1844-0324</p>
            <p className="font-bold text-gray-300">사업자번호: 704-87-00438 | 운송주선사업허가: 대전 2021-01 호</p>
            <p className="pt-10 border-t border-gray-800 text-xs font-bold opacity-40 tracking-widest">
              © 2024 (주)전국특송화물. ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
