/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  PlusCircle,
  Search, 
  Video, 
  Clapperboard, 
  Image as ImageIcon, 
  Film, 
  Sparkles, 
  Target, 
  Anchor,
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Music,
  Mic,
  UserCheck,
  Download,
  Pause,
  Play,
  X,
  Trash2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Save,
  FileSpreadsheet,
  PenTool,
  Ghost
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { analyzeVideo, upgradeAnalysis, generateSpeech, generateImage, regenerateSEO, generateThumbnails, VideoAnalysis, Scene } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function pcmToWav(pcmBase64: string, sampleRate: number = 24000): string {
  const binaryString = atob(pcmBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + len, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, len, true);

  // Write PCM data
  new Uint8Array(buffer, 44).set(bytes);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const VOICES = [
  { id: 'Puck', name: 'Puck', gender: 'Nam', tone: 'Trẻ trung, năng động', suitable: 'Vlog, review, tin tức nhanh' },
  { id: 'Charon', name: 'Charon', gender: 'Nam', tone: 'Trầm ấm, tin cậy', suitable: 'Kể chuyện, phim tài liệu, hướng dẫn' },
  { id: 'Kore', name: 'Kore', gender: 'Nữ', tone: 'Chuyên nghiệp, rõ ràng', suitable: 'Thuyết trình, tin tức, doanh nghiệp' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Nam', tone: 'Mạnh mẽ, uy quyền', suitable: 'Trailer phim, quảng cáo, truyền cảm hứng' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Nữ', tone: 'Nhẹ nhàng, truyền cảm', suitable: 'Thiền, kể chuyện tâm tình, video chữa lành' },
];

const VISUAL_STYLES = [
  { id: 'realistic', name: 'Tả thực (Realistic)', description: 'Ảnh chụp thực tế, chi tiết cao, ánh sáng tự nhiên', prompt: 'Photorealistic, 8k resolution, highly detailed, natural lighting, cinematic photography' },
  { id: 'pixar', name: '3D Pixar/Disney', description: 'Phong cách hoạt hình 3D, màu sắc rực rỡ, nhân vật đáng yêu', prompt: '3D render, Pixar style, Disney animation, vibrant colors, soft shadows, high quality 3D model' },
  { id: 'anime', name: 'Anime Nhật Bản', description: 'Phong cách hoạt hình 2D Nhật Bản, nét vẽ tay, màu sắc nghệ thuật', prompt: 'Studio Ghibli style, high quality anime, hand-drawn aesthetic, vibrant colors, detailed backgrounds' },
  { id: 'cyberpunk', name: 'Cyberpunk/Neon', description: 'Tương lai giả tưởng, ánh sáng neon, không khí u tối', prompt: 'Cyberpunk aesthetic, neon lights, futuristic city, high contrast, cinematic lighting, synthwave colors' },
  { id: 'cinematic', name: 'Điện ảnh (Cinematic)', description: 'Phong cách phim Hollywood, ánh sáng kịch tính, góc quay rộng', prompt: 'Cinematic film still, Hollywood movie lighting, dramatic shadows, anamorphic lens, high production value' },
  { id: 'oil-painting', name: 'Sơn dầu (Oil Painting)', description: 'Phong cách hội họa cổ điển, nét vẽ cọ rõ ràng', prompt: 'Classic oil painting, visible brushstrokes, rich textures, artistic masterpiece, museum quality' },
  { id: 'whiteboard', name: 'Bảng trắng (Whiteboard)', description: 'Phong cách giảng dạy trên bảng trắng, nét vẽ bút lông', prompt: 'Whiteboard animation style, hand-drawn markers on whiteboard, clean lines, educational aesthetic' },
  { id: 'chalkboard', name: 'Vẽ phấn (Chalkboard)', description: 'Phong cách vẽ phấn trên bảng đen nghệ thuật', prompt: 'Chalk art style, white and colored chalk on blackboard, hand-drawn texture, dusty charcoal aesthetic, teachers handwriting' },
  { id: 'stickman', name: 'Người que (Stickman)', description: 'Phong cách tối giản với các nhân vật người que', prompt: 'Stickman animation style, minimalist line art characters, high contrast, expressive simple movements' },
  { id: 'sketchnote', name: 'Sketchnote', description: 'Phong cách ghi chú hình ảnh nghệ thuật', prompt: 'Sketchnote style, hand-drawn visual notes, mix of typography and icons, artistic doodle aesthetic' },
  { id: 'hand-drawn', name: 'Vẽ tay (Hand-drawn)', description: 'Phong cách vẽ thô sơ, đầy nghệ thuật', prompt: 'Hand-drawn sketch style, rough pencil strokes, artistic charcoal texture, expressive and organic' },
  { id: 'anthropomorphism', name: 'Nhân hóa (Anthropomorphic)', description: 'Vật thể hoặc động vật có cảm xúc và hành động như con người', prompt: 'Anthropomorphic style, animals or objects with human characteristics, expressive faces, wearing human clothes, whimsical and creative, character-driven storytelling' },
];

interface HistoryItem {
  id: string;
  timestamp: number;
  title: string;
  analysis: VideoAnalysis;
  originalAnalysis?: VideoAnalysis | null;
  isUpgraded: boolean;
  activeTab: 'original' | 'upgraded';
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [originalAnalysis, setOriginalAnalysis] = useState<VideoAnalysis | null>(null);
  const [isUpgraded, setIsUpgraded] = useState(false);
  const [activeTab, setActiveTab] = useState<'original' | 'upgraded'>('original');
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [mode, setMode] = useState<'url' | 'file' | 'script'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scriptContent, setScriptContent] = useState('');
  const [targetTool, setTargetTool] = useState<'veo' | 'sora' | 'grok' | 'grok6'>('veo');
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  const [selectedStyle, setSelectedStyle] = useState<string>('realistic');
  const [isRemixing, setIsRemixing] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState<string | null>(null);
  const [generatedAudios, setGeneratedAudios] = useState<Record<string, string>>({});
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({});
  const [isGeneratingImage, setIsGeneratingImage] = useState<string | null>(null);
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [isGeneratingCharacterImage, setIsGeneratingCharacterImage] = useState<string | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [editingSceneIdx, setEditingSceneIdx] = useState<number | null>(null);
  const [tempScene, setTempScene] = useState<Scene | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [targetDuration, setTargetDuration] = useState('auto');
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(!process.env.GEMINI_API_KEY);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Persistence for current project
  React.useEffect(() => {
    const savedState = localStorage.getItem('current_project_state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        setAnalysis(state.analysis || null);
        setOriginalAnalysis(state.originalAnalysis || null);
        setIsUpgraded(state.isUpgraded || false);
        setActiveTab(state.activeTab || 'original');
        setTargetTool(state.targetTool || 'veo');
        setSelectedStyle(state.selectedStyle || 'realistic');
        setTargetDuration(state.targetDuration || 'auto');
        setMode(state.mode || 'url');
        setUrl(state.url || '');
        setScriptContent(state.scriptContent || '');
      } catch (e) {
        console.error("Failed to load project state:", e);
      }
    }
  }, []);

  React.useEffect(() => {
    const stateToSave = {
      analysis,
      originalAnalysis,
      isUpgraded,
      activeTab,
      targetTool,
      selectedStyle,
      targetDuration,
      mode,
      url,
      scriptContent
    };
    if (analysis) {
      localStorage.setItem('current_project_state', JSON.stringify(stateToSave));
    }
  }, [analysis, originalAnalysis, isUpgraded, activeTab, targetTool, selectedStyle, mode, url, scriptContent]);

  const [isGeneratingNextTheme, setIsGeneratingNextTheme] = useState(false);

  const handleCreateNextTheme = async (theme: { title: string; description: string; angle: string }) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setOriginalAnalysis(null);
    setIsUpgraded(false);
    setActiveTab('original');
    setMode('script');
    setScriptContent(`${theme.title}\n\n${theme.description}\n\nAngle: ${theme.angle}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const stylePrompt = VISUAL_STYLES.find(s => s.id === selectedStyle)?.prompt;
      const themeContext = `Hãy viết một kịch bản video viral hoàn chỉnh dựa trên chủ đề: "${theme.title}". 
      Mô tả chủ đề: ${theme.description}. 
      Góc độ tiếp cận (Angle): ${theme.angle}.
      YÊU CẦU:
      1. Viết kịch bản theo phong cách thành công của video trước đó.
      2. Đảm bảo độ cuốn hút ngay từ 3 giây đầu tiên (Hook).
      3. Giải quyết triệt để nỗi đau/vấn đề đã đề cập.
      4. Sử dụng công cụ ${targetTool.toUpperCase()} để tối ưu cảnh.`;

      const result = await analyzeVideo(undefined, undefined, undefined, targetTool, themeContext, stylePrompt);
      setAnalysis(result);
      saveToHistory(result);
    } catch (err: any) {
      console.error("Next theme creation error:", err);
      setError(err.message || "Không thể tạo kịch bản từ chủ đề này.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewProject = () => {
    if (confirm("Xác nhận xóa dự án hiện tại để bắt đầu dự án mới?")) {
      setAnalysis(null);
      setOriginalAnalysis(null);
      setIsUpgraded(false);
      setActiveTab('original');
      setUrl('');
      setScriptContent('');
      setSelectedFile(null);
      setError(null);
      setGeneratedAudios({});
      setGeneratedImages({});
      setCharacterImages({});
      setCompressionProgress(0);
      setCompressing(false);
      setLoading(false);
      setEditingSceneIdx(null);
      localStorage.removeItem('current_project_state');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const removeVietnameseTones = (str: string) => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|ã|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    // Some system encode Vietnamese combining accent as individual utf-8 characters
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // modern
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // Â, Ê, Ă, Ơ, Ư
    // Remove extra spaces
    str = str.replace(/ + /g, " ");
    str = str.trim();
    // Remove punctuations and non-alphanumeric except space and underscore
    str = str.replace(/!|@|%|\^|\*|\(|\)|\+|\=|\<|\>|\?|\/|,|\.|\:|\;|\'|\"|\&|\#|\[|\]|~|\$|_|`|-|{|}|\||\\/g, " ");
    return str;
  };

  const exportToExcel = () => {
    if (!analysis) return;

    const workbook = XLSX.utils.book_new();
    
    // 1. Character Prompts Sheet
    const charData = analysis.characters.map(char => ({
      'Tên Nhân Vật': char.name,
      'Mô Tả Ngoại Hình': char.description,
      'Prompt Tạo Nhân Vật (Identity)': char.visualPrompt
    }));
    const charSheet = XLSX.utils.json_to_sheet(charData);
    
    // Set column widths for charSheet
    charSheet['!cols'] = [
      { wch: 20 },
      { wch: 50 },
      { wch: 80 }
    ];
    XLSX.utils.book_append_sheet(workbook, charSheet, "Nhân Vật");

    // 2. Scene Prompts Sheet
    const sceneData = analysis.scenes.map((scene, index) => ({
      'STT': index + 1,
      'Thời gian': scene.timestamp,
      'Mô tả phân cảnh': scene.description,
      'Chi tiết hình ảnh': scene.visualDetail,
      'Prompt Ảnh Minh Họa': scene.imagePrompt,
      'Prompt Video (Full)': scene.fullVideoPrompt,
      'Lời thoại (Voiceover)': scene.voiceoverText
    }));
    const sceneSheet = XLSX.utils.json_to_sheet(sceneData);
    
    // Set column widths for sceneSheet
    sceneSheet['!cols'] = [
      { wch: 5 },
      { wch: 10 },
      { wch: 40 },
      { wch: 50 },
      { wch: 80 },
      { wch: 100 },
      { wch: 60 }
    ];
    XLSX.utils.book_append_sheet(workbook, sceneSheet, "Phân Cảnh & Prompts");

    // 3. Overview Sheet
    const overviewData = [
      ['Tiêu đề kịch bản', analysis.title],
      ['Tóm tắt nội dung', analysis.summary],
      ['Đối tượng mục tiêu', analysis.targetAudience],
      ['Phong cách audio', analysis.audioStyle],
      ['Giọng đọc gợi ý', analysis.suggestedVoice],
      ['Reference Nhân Vật', analysis.characterReference]
    ];
    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    overviewSheet['!cols'] = [{ wch: 25 }, { wch: 100 }];
    XLSX.utils.book_append_sheet(workbook, overviewSheet, "Tổng Quan");

    // Export the file with no-accent Vietnamese names
    const cleanTitle = removeVietnameseTones(analysis.title)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .toLowerCase();
    
    const fileName = `Viral_AI_Studio_${cleanTitle || 'kich_ban'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setCompressing(false);
    setCompressionProgress(0);
  };

  const saveToHistory = (currentAnalysis: VideoAnalysis, original?: VideoAnalysis | null, upgraded?: boolean, tab?: 'original' | 'upgraded') => {
    if (!currentAnalysis) return;
    
    setHistory(prev => {
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        title: currentAnalysis.title || 'Kịch bản không tên',
        analysis: currentAnalysis,
        originalAnalysis: original,
        isUpgraded: upgraded || false,
        activeTab: tab || 'original'
      };
      
      // Remove duplicates with same title to keep history clean
      const filtered = prev.filter(item => item.title !== newItem.title);
      const newHistory = [newItem, ...filtered].slice(0, 10);
      localStorage.setItem('video_tool_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const loadFromHistory = (item: HistoryItem) => {
    setAnalysis(item.analysis);
    setOriginalAnalysis(item.originalAnalysis || null);
    setIsUpgraded(item.isUpgraded);
    setActiveTab(item.activeTab);
    setShowHistory(false);
    
    // Scroll to results
    setTimeout(() => {
      const resultsEl = document.getElementById('analysis-results');
      if (resultsEl) {
        resultsEl.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('video_tool_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleStyleRemix = async (styleId: string) => {
    if (!analysis) return;
    
    const style = VISUAL_STYLES.find(s => s.id === styleId);
    if (!style) return;

    setSelectedStyle(styleId);
    setIsRemixing(true);
    setError(null);

    try {
      // Capture original analysis on first upgrade/remix
      if (!isUpgraded) {
        setOriginalAnalysis(analysis);
      }

      // We'll use Gemini to remix the prompts based on the new style
      // but keeping the core content and character consistency.
      const remixedAnalysis = await upgradeAnalysis(analysis, targetTool, `Hãy remix toàn bộ kịch bản sang phong cách: ${style.name}. 
      YÊU CẦU:
      1. GIỮ NGUYÊN nội dung, hành động và tính đồng nhất nhân vật.
      2. THAY ĐỔI toàn bộ Image Prompt và Full Video Prompt để phản ánh phong cách ${style.name} (${style.prompt}).
      3. Cập nhật phần mô tả phong cách hình ảnh (Visual Style) trong phần tổng quan.
      4. Đảm bảo các prompt tiếng Anh chuyên nghiệp và tối ưu cho AI Video.`, 'auto', style.prompt);

      setAnalysis(remixedAnalysis);
      setIsUpgraded(true);
      setActiveTab('upgraded');
      saveToHistory(remixedAnalysis, isUpgraded ? originalAnalysis : analysis, true, 'upgraded');
      
      // Clear generated images as they don't match the new style
      setGeneratedImages({});
    } catch (err: any) {
      console.error("Style remix error:", err);
      setError("Không thể remix phong cách. Vui lòng thử lại.");
    } finally {
      setIsRemixing(false);
    }
  };

  const handleGenerateSpeech = async (text: string, sceneIdx: number) => {
    const key = sceneIdx === -1 ? `script-${selectedVoice}` : `scene-${sceneIdx}-${selectedVoice}`;
    
    // If already playing this scene with current voice, toggle pause/play
    if (playingAudio === key) {
      if (audioRef.current) {
        if (isPaused) {
          audioRef.current.play().catch(e => console.error("Play error:", e));
          setIsPaused(false);
        } else {
          audioRef.current.pause();
          setIsPaused(true);
        }
      }
      return;
    }

    // Stop previous audio if any other sound is playing
    stopSpeech();

    // If we already have the audio URL, just play it
    if (generatedAudios[key]) {
      const audio = new Audio(generatedAudios[key]);
      audioRef.current = audio;
      setPlayingAudio(key);
      setIsPaused(false);
      
      audio.onended = () => {
        setPlayingAudio(null);
        setIsPaused(false);
      };

      audio.play().catch(err => {
        console.error("Playback failed:", err);
        setError("Không thể phát âm thanh. Hãy thử nhấn lại.");
        setPlayingAudio(null);
      });
      return;
    }

    setIsGeneratingSpeech(key);
    try {
      const { data: base64 } = await generateSpeech(text, selectedVoice);
      const audioUrl = pcmToWav(base64);
      setGeneratedAudios(prev => ({ ...prev, [key]: audioUrl }));
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingAudio(key);
      setIsPaused(false);
      
      audio.onended = () => {
        setPlayingAudio(null);
        setIsPaused(false);
      };

      await audio.play();
    } catch (err: any) {
      console.error("Speech generation error:", err);
      setError(err.message);
      setPlayingAudio(null);
    } finally {
      setIsGeneratingSpeech(null);
    }
  };

  const stopSpeech = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingAudio(null);
    setIsPaused(false);
  };

  const handleGenerateCharacterImage = async (characterName: string, visualPrompt: string) => {
    setIsGeneratingCharacterImage(characterName);
    try {
      const imageUrl = await generateImage(visualPrompt, analysis?.characterReference);
      setCharacterImages(prev => ({ ...prev, [characterName]: imageUrl }));
    } catch (err: any) {
      console.error("Character image generation error:", err);
      setError(err.message);
    } finally {
      setIsGeneratingCharacterImage(null);
    }
  };

  const downloadCharacterImage = (characterName: string) => {
    const url = characterImages[characterName];
    if (!url) return;
    
    const scriptTitle = analysis?.title || 'Kịch bản';
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nhân vật - ${characterName} - ${scriptTitle}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerateImage = async (prompt: string, sceneIdx: number) => {
    const key = `scene-${sceneIdx}`;
    setIsGeneratingImage(key);
    try {
      const currentAnalysis = activeTab === 'original' ? originalAnalysis : analysis;
      let charRef = currentAnalysis?.characterReference;
      
      // Find if there's a character image to reference
      let referenceImageBase64 = undefined;
      if (currentAnalysis?.characters && currentAnalysis.characters.length > 0) {
        // Try to find which character is mentioned in the prompt or scene description
        const scene = currentAnalysis.scenes[sceneIdx];
        const mentionedChar = currentAnalysis.characters.find(char => 
          prompt.toLowerCase().includes(char.name.toLowerCase()) || 
          scene.description.toLowerCase().includes(char.name.toLowerCase())
        );

        const charToUse = mentionedChar || currentAnalysis.characters[0];
        
        // Use the specific character's visual prompt for better consistency
        charRef = charToUse.visualPrompt;

        if (characterImages[charToUse.name]) {
          referenceImageBase64 = characterImages[charToUse.name].split(',')[1];
        }
      }
        
      const imageUrl = await generateImage(prompt, charRef, referenceImageBase64, selectedStyle);
      setGeneratedImages(prev => ({ ...prev, [key]: imageUrl }));
    } catch (err: any) {
      console.error("Image generation error:", err);
      setError(err.message);
    } finally {
      setIsGeneratingImage(null);
    }
  };

  const downloadSceneImage = (sceneIdx: number) => {
    const key = `scene-${sceneIdx}`;
    const url = generatedImages[key];
    if (!url) return;
    
    const scriptTitle = analysis?.title || 'Kịch bản';
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cảnh ${sceneIdx + 1} - ${scriptTitle}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRegenerateSEO = async () => {
    if (!analysis) return;
    setIsGeneratingSEO(true);
    setError(null);
    try {
      const result = await regenerateSEO(analysis);
      
      const newAnalysis = { ...analysis, ...result };
      setAnalysis(newAnalysis);

      if (activeTab === 'original' && originalAnalysis) {
        setOriginalAnalysis({ ...originalAnalysis, ...result });
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGeneratingSEO(false);
    }
  };

  const handleRegenerateThumbnails = async () => {
    if (!analysis) return;
    setIsGeneratingThumbnails(true);
    setError(null);
    try {
      const result = await generateThumbnails(analysis);
      
      const newAnalysis = { ...analysis, ...result };
      setAnalysis(newAnalysis);

      if (activeTab === 'original' && originalAnalysis) {
        setOriginalAnalysis({ ...originalAnalysis, ...result });
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGeneratingThumbnails(false);
    }
  };

  const downloadAudio = (sceneIdx: number) => {
    const key = sceneIdx === -1 ? `script-${selectedVoice}` : `scene-${sceneIdx}-${selectedVoice}`;
    const url = generatedAudios[key];
    if (!url) return;
    
    const scriptTitle = analysis?.title || 'Kịch bản';
    const a = document.createElement('a');
    a.href = url;
    const name = sceneIdx === -1 ? 'Toan-bo-kich-ban' : `Canh-${sceneIdx + 1}`;
    a.download = `${name}-${selectedVoice}-${removeVietnameseTones(scriptTitle).replace(/\s+/g, '_')}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const ffmpegRef = React.useRef(new FFmpeg());

  React.useEffect(() => {
    // Load history from localStorage
    const savedHistory = localStorage.getItem('video_tool_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history:", e);
      }
    }

    if (analysis?.suggestedVoice) {
      setSelectedVoice(analysis.suggestedVoice);
    }
  }, [analysis]);

  React.useEffect(() => {
    return () => {
      // Cleanup audio URLs on unmount
      Object.values(generatedAudios).forEach(url => URL.revokeObjectURL(url));
      Object.values(characterImages).forEach(url => URL.revokeObjectURL(url));
      Object.values(generatedImages).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const loadFFmpeg = async () => {
    try {
      console.log("Loading FFmpeg...");
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      const ffmpeg = ffmpegRef.current;
      
      ffmpeg.on('log', ({ message }) => {
        console.log("FFmpeg Log:", message);
      });
      
      ffmpeg.on('progress', ({ progress }) => {
        console.log("FFmpeg Progress:", progress);
        setCompressionProgress(Math.round(progress * 100));
      });

      // Check if headers are working
      if (!window.crossOriginIsolated) {
        console.warn("Cross-Origin Isolation is not enabled. FFmpeg might be slow or fail.");
      }

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      console.log("FFmpeg Loaded successfully");
      setFfmpegLoaded(true);
    } catch (err: any) {
      console.error("FFmpeg Load Error:", err);
      throw new Error("Không thể khởi tạo bộ nén video. Hãy thử lại hoặc sử dụng trình duyệt khác.");
    }
  };

  const compressVideo = async (file: File) => {
    setCompressing(true);
    setCompressionProgress(0);
    setError(null);
    try {
      if (!ffmpegLoaded) {
        await loadFFmpeg();
      }
      
      const ffmpeg = ffmpegRef.current;
      const inputName = 'input.mp4';
      const outputName = 'output.mp4';

      console.log("Writing file to FFmpeg FS...");
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      console.log("Executing compression command...");
      // Optimized for speed and size
      await ffmpeg.exec([
        '-i', inputName,
        '-vf', 'scale=trunc(iw/4)*2:trunc(ih/4)*2', // Scale down significantly for speed
        '-c:v', 'libx264',
        '-crf', '28',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        '-b:a', '64k',
        outputName
      ]);

      console.log("Reading compressed file...");
      const data = await ffmpeg.readFile(outputName);
      const compressedBlob = new Blob([data], { type: 'video/mp4' });
      const compressedFile = new File([compressedBlob], `compressed_${file.name}`, { type: 'video/mp4' });
      
      console.log("Compression complete. Original:", file.size, "New:", compressedFile.size);
      setSelectedFile(compressedFile);
      setCompressing(false);
      setCompressionProgress(100);
    } catch (err: any) {
      console.error('Compression execution error:', err);
      setError("Lỗi nén video: " + (err.message || "Hãy thử lại với video ngắn hơn."));
      setCompressing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      
      // If file is too large, we'll show the compression option in the UI instead of blocking
      if (file.size > 19 * 1024 * 1024) {
        // We'll handle the warning in the render
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpgrade = async () => {
    if (!analysis) return;
    setUpgrading(true);
    setError(null);
    try {
      const stylePrompt = VISUAL_STYLES.find(s => s.id === selectedStyle)?.prompt;
      console.log("Upgrading script based on suggestions and target duration:", targetDuration);
      const upgraded = await upgradeAnalysis(analysis, targetTool, undefined, targetDuration, stylePrompt);
      if (!isUpgraded) {
        setOriginalAnalysis(analysis);
      }
      setAnalysis(upgraded);
      setIsUpgraded(true);
      setActiveTab('upgraded');
      saveToHistory(upgraded, analysis, true, 'upgraded');
      console.log("Upgrade complete");
      // Scroll to top of results
      const resultsEl = document.getElementById('analysis-results');
      if (resultsEl) {
        resultsEl.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setError(err.message || "Không thể nâng cấp kịch bản. Vui lòng thử lại.");
    } finally {
      setUpgrading(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Analyze button clicked. Mode:", mode);
    
    if (mode === 'url' && !url.trim()) {
      setError("Vui lòng dán link video.");
      return;
    }
    if (mode === 'file' && !selectedFile) {
      setError("Vui lòng chọn file video.");
      return;
    }
    if (mode === 'script' && !scriptContent.trim()) {
      setError("Vui lòng nhập kịch bản.");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);
    setOriginalAnalysis(null);
    setIsUpgraded(false);
    setActiveTab('original');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      let result;
      // If we are analyzing an EXISTING video/file, we want Gemini to DETECT the style, not force one.
      // If it's a SCRIPT (starting from scratch), we use the selected style.
      const shouldForceStyle = mode === 'script';
      const stylePrompt = shouldForceStyle ? VISUAL_STYLES.find(s => s.id === selectedStyle)?.prompt : undefined;
      
      if (mode === 'file' && selectedFile) {
        console.log("Converting file to base64...");
        const base64 = await fileToBase64(selectedFile);
        console.log("Sending to Gemini for analysis...");
        result = await analyzeVideo(undefined, base64, selectedFile.type, targetTool, undefined, stylePrompt);
      } else if (mode === 'script') {
        console.log("Analyzing script content...");
        result = await analyzeVideo(undefined, undefined, undefined, targetTool, scriptContent, stylePrompt);
      } else {
        console.log("Analyzing video from URL:", url);
        result = await analyzeVideo(url, undefined, undefined, targetTool, undefined, stylePrompt);
      }
      console.log("Analysis complete:", result);
      setAnalysis(result);

      // Auto-detect style from analysis result if not forced
      if (!shouldForceStyle && result.visualStyle) {
        const detectedStyle = VISUAL_STYLES.find(s => 
          result.visualStyle.toLowerCase().includes(s.name.toLowerCase()) || 
          result.visualStyle.toLowerCase().includes(s.id.toLowerCase())
        );
        if (detectedStyle) {
          setSelectedStyle(detectedStyle.id);
        }
      }
      saveToHistory(result);
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || 'Đã có lỗi xảy ra khi phân tích video. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleStartEditScene = (scene: Scene, idx: number) => {
    setEditingSceneIdx(idx);
    setTempScene({ ...scene });
  };

  const handleViewOriginal = () => {
    if (mode === 'url' && url) {
      window.open(url, '_blank');
    } else if (mode === 'file' && selectedFile) {
      const fileUrl = URL.createObjectURL(selectedFile);
      window.open(fileUrl, '_blank');
    } else if (mode === 'script') {
      alert("Dự án bắt đầu từ kịch bản, không có video gốc.");
    } else {
      setError("Không tìm thấy thông tin video gốc.");
    }
  };

  const handleSaveScene = () => {
    if (editingSceneIdx === null || !tempScene) return;

    if (activeTab === 'original' && isUpgraded && originalAnalysis) {
      const updatedScenes = [...originalAnalysis.scenes];
      updatedScenes[editingSceneIdx] = tempScene;
      const updatedAnalysis = {
        ...originalAnalysis,
        scenes: updatedScenes
      };
      setOriginalAnalysis(updatedAnalysis);
      // Update history if needed
      const currentHistoryIdx = history.findIndex(h => h.analysis.title === originalAnalysis.title);
      if (currentHistoryIdx !== -1) {
        const updatedHistory = [...history];
        updatedHistory[currentHistoryIdx].originalAnalysis = updatedAnalysis;
        setHistory(updatedHistory);
      }
    } else if (analysis) {
      const updatedScenes = [...analysis.scenes];
      updatedScenes[editingSceneIdx] = tempScene;
      const updatedAnalysis = {
        ...analysis,
        scenes: updatedScenes
      };
      setAnalysis(updatedAnalysis);
      // Update history if needed
      const currentHistoryIdx = history.findIndex(h => h.analysis.title === analysis.title);
      if (currentHistoryIdx !== -1) {
        const updatedHistory = [...history];
        updatedHistory[currentHistoryIdx].analysis = updatedAnalysis;
        setHistory(updatedHistory);
      }
    }

    setEditingSceneIdx(null);
    setTempScene(null);
  };

  const getEstimatedDuration = (sceneCount: number) => {
    const perScene = targetTool === 'veo' ? 8 : targetTool === 'grok' ? 10 : targetTool === 'grok6' ? 6 : 12.5;
    const totalSeconds = sceneCount * perScene;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Clapperboard size={18} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Chuyên Gia Video Viral</h1>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-gray-500">
            <button 
              onClick={handleNewProject}
              className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
              title="Khởi tạo dự án mới"
            >
              <PlusCircle size={18} />
              <span className="hidden sm:inline">Dự án mới</span>
            </button>
            <button 
              onClick={() => setShowHistory(true)}
              className="hover:text-emerald-600 transition-colors"
            >
              Lịch sử
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-4 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          <div className="lg:col-span-3 flex flex-col justify-center">
            {/* Hero Section */}
            <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-gray-900 via-gray-800 to-emerald-800 bg-clip-text text-transparent">
            Mổ xẻ kịch bản video ngắn
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Dán link TikTok, Reels hoặc YouTube Shorts để nhận phân tích chi tiết kịch bản, 
            phân cảnh và prompt AI sáng tạo.
          </p>

          {showApiKeyWarning && (
            <div className="mt-8 max-w-2xl mx-auto p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 text-left animate-in fade-in slide-in-from-top-4 duration-500">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-amber-800 font-bold">⚠️ Lưu ý cho dự án Remix</p>
                <p className="text-amber-700 text-sm leading-relaxed">
                  Để công cụ hoạt động, bạn cần tự cấu hình API Key của mình. Hãy nhấn vào biểu tượng 
                  <strong className="mx-1">Settings (Bánh răng)</strong> ở góc dưới bên trái màn hình Code, tìm biến 
                  <code className="mx-1 px-1.5 py-0.5 bg-amber-200/50 rounded font-mono text-amber-900 text-xs">GEMINI_API_KEY</code> 
                  và dán khóa API của bạn vào đó. 
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="ml-1 text-emerald-700 underline font-bold hover:text-emerald-800">
                    Lấy Key miễn phí tại đây
                  </a>.
                </p>
                <button 
                  onClick={() => setShowApiKeyWarning(false)}
                  className="mt-2 text-[10px] font-bold text-amber-600/60 hover:text-amber-600 uppercase tracking-widest transition-colors"
                >
                  Đã hiểu, ẩn thông báo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mode Switcher */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
            <button 
              onClick={() => setMode('url')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                mode === 'url' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Dán Link
            </button>
            <button 
              onClick={() => setMode('script')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                mode === 'script' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Dán Kịch Bản
            </button>
            <button 
              onClick={() => setMode('file')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                mode === 'file' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Tải Video Lên
              <span className="bg-emerald-100 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-tighter">Chính xác nhất</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tối ưu cho:</span>
            <div className="flex gap-2">
              {[
                { id: 'veo', name: 'Veo 3', desc: 'Max 8s' },
                { id: 'sora', name: 'Sora 2', desc: '10-15s' },
                { id: 'grok', name: 'Grok 10s', desc: 'Sáng tạo' },
                { id: 'grok6', name: 'Grok 6s', desc: 'Nhanh' }
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setTargetTool(tool.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex flex-col items-center",
                    targetTool === tool.id 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm" 
                      : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                  )}
                >
                  <span>{tool.name}</span>
                  <span className="text-[8px] opacity-60">{tool.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search / Upload Input */}
        <div className="max-w-3xl mx-auto mb-16">
          <form onSubmit={handleAnalyze} className="relative group">
            {mode === 'url' && (
              <>
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Video className="text-gray-400 group-focus-within:text-emerald-600 transition-colors" size={20} />
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Dán link video tại đây (TikTok, Facebook, YouTube...)"
                  className="w-full pl-12 pr-32 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-lg"
                  required={mode === 'url'}
                />
              </>
            )}

            {mode === 'script' && (
              <div className="relative">
                <div className="absolute top-4 left-4 pointer-events-none">
                  <Clapperboard className="text-gray-400 group-focus-within:text-emerald-600 transition-colors" size={20} />
                </div>
                <textarea
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
                  placeholder="Dán kịch bản thô hoặc kịch bản sẵn có của bạn tại đây..."
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-lg min-h-[160px] resize-none"
                  required={mode === 'script'}
                />
              </div>
            )}

            {mode === 'file' && (
              <div className="relative">
                <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl bg-white hover:bg-gray-50 transition-colors cursor-pointer group/upload">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Film className="w-8 h-8 mb-3 text-gray-400 group-hover/upload:text-emerald-500 transition-colors" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-bold">Click để tải lên</span> hoặc kéo thả video
                    </p>
                    <p className="text-xs text-gray-400">MP4, MOV, WebM (Tối đa 20MB). Tip: Sử dụng video ngắn hoặc nén để có kết quả tốt nhất.</p>
                  </div>
                  <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
                </label>
                {selectedFile && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 italic text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded">
                          <Film size={14} />
                        </div>
                        <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                        <span className="text-gray-400 text-xs">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedFile.size > 19 * 1024 * 1024 && !compressing && (
                          <button
                            type="button"
                            onClick={() => compressVideo(selectedFile)}
                            className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1"
                          >
                            <Sparkles size={12} />
                            Nén ngay
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleClearFile}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Xóa file"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {selectedFile.size > 19 * 1024 * 1024 && !compressing && (
                      <p className="text-[10px] text-amber-600 font-medium">
                        * File vượt quá 20MB. Hãy nhấn "Nén ngay" để tự động giảm dung lượng trước khi phân tích.
                      </p>
                    )}

                    {compressing && (
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span>{ffmpegLoaded ? "Đang nén video..." : "Đang khởi tạo bộ nén..."}</span>
                          <span>{compressionProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 transition-all duration-300" 
                            style={{ width: `${compressionProgress}%` }}
                          ></div>
                        </div>
                        {!ffmpegLoaded && (
                          <p className="text-[10px] text-gray-400 italic animate-pulse">
                            Lần đầu khởi tạo có thể mất vài giây để tải thư viện...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading || compressing || (mode === 'file' && (!selectedFile || selectedFile.size > 19 * 1024 * 1024))}
              className={cn(
                "mt-4 w-full sm:mt-0 sm:absolute sm:right-2 sm:top-2 sm:bottom-2 sm:w-auto px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20",
                (mode === 'file' || mode === 'script') && "sm:relative sm:mt-4 sm:right-0 sm:top-0 sm:bottom-0"
              )}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              <span>{loading ? 'Đang phân tích...' : 'Bắt đầu phân tích'}</span>
            </button>
          </form>
        </div>
          </div>

          {/* Right Sidebar - Author Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 flex flex-col items-center text-center sticky top-8">
              <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-4 ring-4 ring-emerald-50">
                HN
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Hữu Nghĩa GV</h3>
              <p className="text-xs text-gray-500 mb-6 px-2 leading-relaxed">
                Xin chào! Cám ơn bạn đã sử dụng bộ công cụ <strong className="text-emerald-600">Video Insight Pro</strong>.
              </p>
              
              <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
                <p className="text-[13px] text-emerald-800 font-bold mb-3 relative z-10 text-left">
                  🔥 Cần tool Veo 3 / Grok tạo video hàng loạt và tài khoản AI các loại liên hệ zalo
                </p>
                <a 
                  href="https://zalo.me/0707155117" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="relative z-10 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all w-full shadow-sm hover:shadow-md"
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/1024px-Icon_of_Zalo.svg.png" alt="Zalo" className="w-5 h-5 bg-white rounded-full p-0.5" />
                  <span>0707.155.117</span>
                </a>
              </div>

              <div className="w-full relative group">
                <input type="checkbox" id="qr-zoom" className="peer hidden" />
                <label htmlFor="qr-zoom" className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col items-center overflow-hidden cursor-pointer hover:bg-gray-100 hover:border-gray-200 transition-all shadow-sm hover:shadow">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2 w-full justify-center">
                    <span className="flex-1 h-px bg-gray-200"></span>
                    Ủng hộ dự án
                    <span className="flex-1 h-px bg-gray-200"></span>
                  </p>
                  
                  {/* QR Image Container */}
                  <div className="w-[180px] h-[180px] bg-white rounded-xl mb-3 flex flex-col items-center justify-center overflow-hidden border border-gray-200 relative p-2 shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
                    <img 
                      src="https://img.vietqr.io/image/MB-8455555456789-print.png?addInfo=Donate&accountName=NGUYEN%20HUU%20NGHIA" 
                      alt="QR Ngân Hàng" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Search size={12} /> Phóng to
                    </div>
                  </div>
                  
                  <p className="text-xs font-medium text-gray-600 leading-relaxed max-w-[200px]">
                    Gửi tặng <span className="font-bold text-emerald-600">ly cafe</span> để động viên team ra nhiều app hay hơn nữa nhé! ☕️✨
                  </p>
                </label>

                {/* Lightbox / Zoom Modal */}
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center opacity-0 pointer-events-none peer-checked:opacity-100 peer-checked:pointer-events-auto transition-opacity duration-300 p-4 backdrop-blur-sm">
                  <label htmlFor="qr-zoom" className="absolute inset-0 cursor-pointer"></label>
                  <div className="relative bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full mx-auto transform scale-95 peer-checked:scale-100 transition-transform duration-300 shadow-2xl flex flex-col items-center">
                    <label htmlFor="qr-zoom" className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded-full cursor-pointer transition-colors">
                      <X size={18} />
                    </label>
                    
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                      <Search size={24} />
                    </div>
                    
                    <h3 className="text-xl font-extrabold text-gray-900 mb-6 font-sans">Mã QR Thanh Toán</h3>
                    
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-inner w-full mb-6 relative">
                      <img 
                        src="https://img.vietqr.io/image/MB-8455555456789-print.png?addInfo=Donate&accountName=NGUYEN%20HUU%20NGHIA" 
                        alt="QR Ngân Hàng Lớn" 
                        className="w-full h-auto rounded-xl drop-shadow-sm mix-blend-multiply"
                      />
                    </div>
                    
                    <div className="w-full space-y-3 text-sm">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-500">Ngân hàng</span>
                        <span className="font-bold text-gray-900">MB Bank</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-500">Số tài khoản</span>
                        <span className="font-bold text-xl text-emerald-600 tracking-wider">8455555456789</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-500">Tên T/K</span>
                        <span className="font-bold text-gray-900 uppercase">Nguyen Huu Nghia</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6 relative">
              <Sparkles size={40} className="animate-pulse" />
              <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-gray-900 font-bold text-xl">Đang phân tích video của bạn...</p>
              <p className="text-gray-500 max-w-md mx-auto">
                Gemini đang truy cập link, tìm kiếm thông tin và mổ xẻ kịch bản. 
                Quá trình này thường mất 10-20 giây.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}

        {analysis && (
          <div id="analysis-results" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {isUpgraded ? (
                <div className="bg-gray-100 p-1 rounded-2xl flex gap-1 shadow-inner order-2 sm:order-1">
                  <button
                    onClick={() => setActiveTab('original')}
                    className={cn(
                      "px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2",
                      activeTab === 'original' ? "bg-white text-gray-900 shadow-md" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <Clapperboard size={18} />
                    BẢN GỐC
                  </button>
                  <button
                    onClick={() => setActiveTab('upgraded')}
                    className={cn(
                      "px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2",
                      activeTab === 'upgraded' ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <Sparkles size={18} />
                    BẢN NÂNG CẤP (VIRAL)
                  </button>
                </div>
              ) : <div className="hidden sm:block"></div>}
              
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-black rounded-2xl transition-all shadow-sm order-1 sm:order-2"
              >
                <FileSpreadsheet size={20} />
                XUẤT FILE EXCEL PROMPT
              </button>
            </div>
            
            <div className={cn("space-y-8", activeTab === 'original' && isUpgraded ? "opacity-90" : "")}>
              {/* Overview Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Clapperboard size={20} />
                    </div>
                    <h3 className="text-2xl font-bold">
                      {activeTab === 'original' ? (isUpgraded ? "Kịch bản Gốc (Đối chiếu)" : "Tổng quan & Kịch bản") : "Kịch bản & Chiến lược Nâng cấp"}
                    </h3>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Tiêu đề {activeTab === 'upgraded' ? "Mới" : ""}</h4>
                      <p className="text-xl font-semibold text-gray-900">
                        {activeTab === 'original' && originalAnalysis ? originalAnalysis.title : analysis.title}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Tóm tắt {activeTab === 'upgraded' ? "Chiến lược" : ""}</h4>
                      <p className="text-gray-600 leading-relaxed">
                        {activeTab === 'original' && originalAnalysis ? originalAnalysis.summary : analysis.summary}
                      </p>
                    </div>

                    <div className="p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Search size={18} className="text-indigo-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-indigo-600">Phân tích nội dung chuyên sâu</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-[10px] font-bold uppercase text-indigo-400 mb-1">Mục đích nội dung</h5>
                          <p className="text-sm text-indigo-900 leading-relaxed">
                            {(activeTab === 'original' && originalAnalysis ? originalAnalysis.purpose : analysis.purpose) || 'Đang cập nhật...'}
                          </p>
                        </div>
                        <div>
                          <h5 className="text-[10px] font-bold uppercase text-indigo-400 mb-1">Độ đầy đủ nội dung</h5>
                          <p className="text-sm text-indigo-900 leading-relaxed">
                            {(activeTab === 'original' && originalAnalysis ? originalAnalysis.contentCompleteness : analysis.contentCompleteness) || 'Đang cập nhật...'}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <h5 className="text-[10px] font-bold uppercase text-indigo-400 mb-1">Lý do Viral (Virality Reason)</h5>
                          <div className="p-3 bg-white rounded-xl border border-indigo-100 italic text-sm text-indigo-800">
                            "{(activeTab === 'original' && originalAnalysis ? originalAnalysis.viralityReason : analysis.viralityReason) || 'Đang phân tích yếu tố thu hút...'}"
                          </div>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-[10px] font-bold uppercase text-indigo-400 mb-1">Nỗi đau & Vấn đề giải quyết</h5>
                        <div className="flex flex-wrap gap-2">
                          {((activeTab === 'original' && originalAnalysis ? originalAnalysis.painPoints : analysis.painPoints) || []).map((p, i) => (
                            <span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-medium border border-indigo-200">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {((activeTab === 'original' && originalAnalysis ? originalAnalysis.nextThemes : analysis.nextThemes) || []).length > 0 && (
                      <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-purple-600" />
                            <h4 className="text-sm font-bold uppercase tracking-wider text-purple-600">Kế hoạch Content Win: 5-10 chủ đề tiếp theo</h4>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 italic pb-2 border-b border-purple-100">
                          Hãy chọn một chủ đề bên dưới để hệ thống tiếp tục đào sâu và tạo kịch bản viral mới dựa trên "tuyến content win" hiện tại.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {((activeTab === 'original' && originalAnalysis ? originalAnalysis.nextThemes : analysis.nextThemes) || []).map((theme, i) => (
                            <div 
                              key={i} 
                              className="group relative bg-white p-4 rounded-xl border border-purple-100 hover:border-purple-300 hover:shadow-md transition-all cursor-default"
                            >
                              <h5 className="text-sm font-bold text-gray-900 mb-1 flex items-center justify-between">
                                {theme.title}
                                <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded uppercase tracking-tighter">Angle: {theme.angle}</span>
                              </h5>
                              <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2 italic">
                                {theme.description}
                              </p>
                              <button
                                onClick={() => handleCreateNextTheme(theme)}
                                className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:from-purple-700 hover:to-indigo-700 transition-all opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"
                              >
                                <PlusCircle size={14} />
                                Start Creating This Theme
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                          {activeTab === 'original' ? "Kịch bản Gốc" : "Kịch bản đã tối ưu (Viral Script - Đã khớp thời lượng)"}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Voice Selector */}
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Giọng:</span>
                            <select 
                              value={selectedVoice} 
                              onChange={(e) => setSelectedVoice(e.target.value)}
                              className="text-xs font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
                            >
                              {VOICES.map(v => (
                                <option key={v.id} value={v.id}>{v.name} ({v.gender})</option>
                              ))}
                            </select>
                          </div>

                          <button
                            onClick={() => handleGenerateSpeech(activeTab === 'original' && originalAnalysis ? originalAnalysis.originalScript : analysis.originalScript, -1)}
                            disabled={isGeneratingSpeech === `script-${selectedVoice}`}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                              playingAudio === `script-${selectedVoice}`
                                ? "bg-emerald-600 text-white"
                                : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            )}
                          >
                            {isGeneratingSpeech === `script-${selectedVoice}` ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : playingAudio === `script-${selectedVoice}` ? (
                              isPaused ? <Play size={14} /> : <Pause size={14} />
                            ) : (
                              <Mic size={14} />
                            )}
                            <span>
                              {isGeneratingSpeech === `script-${selectedVoice}` 
                                ? 'Đang tạo...' 
                                : playingAudio === `script-${selectedVoice}` 
                                  ? (isPaused ? 'Tiếp tục' : 'Tạm dừng') 
                                  : 'Đọc toàn bộ kịch bản'}
                            </span>
                          </button>

                          {generatedAudios[`script-${selectedVoice}`] && (
                            <button
                              onClick={() => downloadAudio(-1)}
                              className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                              title="Tải về kịch bản đầy đủ"
                            >
                              <Download size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed italic">
                        "{activeTab === 'original' && originalAnalysis ? originalAnalysis.originalScript : analysis.originalScript}"
                      </p>
                    </div>
                    <div className="p-6 bg-blue-50/30 rounded-2xl border border-blue-100">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600">Đồng nhất nhân vật (Character Reference)</h4>
                        <button 
                          onClick={() => copyToClipboard(activeTab === 'original' && originalAnalysis ? originalAnalysis.characterReference : analysis.characterReference, 'char-ref')}
                          className="p-1.5 hover:bg-white rounded-lg transition-colors text-blue-400 hover:text-blue-600"
                        >
                          {copiedIndex === 'char-ref' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      <p className="text-sm text-blue-900 leading-relaxed">
                        {activeTab === 'original' && originalAnalysis ? originalAnalysis.characterReference : analysis.characterReference}
                      </p>
                      <p className="mt-3 text-[10px] text-blue-400 italic font-medium">
                        * Sử dụng đoạn mô tả này trong mọi prompt để giữ nhân vật đồng nhất qua các cảnh.
                      </p>
                    </div>

                    <div className="p-6 bg-amber-50/30 rounded-2xl border border-amber-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Target size={18} className="text-amber-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-amber-600">Phong cách nhận diện (Detected Style)</h4>
                      </div>
                      <p className="text-sm text-amber-900 font-medium">
                        {activeTab === 'original' && originalAnalysis ? originalAnalysis.detectedStyle : analysis.detectedStyle}
                      </p>
                      <p className="mt-2 text-[10px] text-amber-400 italic font-medium">
                        * Hệ thống tự động quét và phân tích phong cách hình ảnh đặc thù của video gốc.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100">
                        <div className="flex items-center gap-2 mb-4">
                          <ThumbsUp size={18} className="text-emerald-600" />
                          <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-600">Ưu điểm (Strengths)</h4>
                        </div>
                        <ul className="space-y-2">
                          {(activeTab === 'original' && originalAnalysis ? originalAnalysis.strengths : analysis.strengths).map((s, i) => (
                            <li key={i} className="text-xs text-emerald-800 flex items-start gap-2">
                              <span className="mt-1 w-1 h-1 bg-emerald-400 rounded-full shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {((activeTab === 'original' && originalAnalysis ? originalAnalysis.weaknesses : analysis.weaknesses) || []).length > 0 && (
                        <div className="p-6 bg-red-50/30 rounded-2xl border border-red-100">
                          <div className="flex items-center gap-2 mb-4">
                            <ThumbsDown size={18} className="text-red-600" />
                            <h4 className="text-sm font-bold uppercase tracking-wider text-red-600">Nhược điểm (Weaknesses)</h4>
                          </div>
                          <ul className="space-y-2">
                            {(activeTab === 'original' && originalAnalysis ? originalAnalysis.weaknesses : analysis.weaknesses).map((w, i) => (
                              <li key={i} className="text-xs text-red-800 flex items-start gap-2">
                                <span className="mt-1 w-1 h-1 bg-red-400 rounded-full shrink-0" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-purple-50/30 rounded-2xl border border-purple-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles size={18} className="text-purple-600" />
                          <h4 className="text-sm font-bold uppercase tracking-wider text-purple-600">Style Remix (Đổi phong cách 1-click)</h4>
                        </div>
                        {isRemixing && <Loader2 size={16} className="text-purple-600 animate-spin" />}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {VISUAL_STYLES.map((style) => (
                          <button
                            key={style.id}
                            disabled={isRemixing}
                            onClick={() => handleStyleRemix(style.id)}
                            className={cn(
                              "p-3 rounded-xl border text-center transition-all relative group flex flex-col items-center gap-2",
                              selectedStyle === style.id 
                                ? "bg-white border-purple-500 shadow-md ring-2 ring-purple-500/10" 
                                : "bg-white/50 border-gray-100 hover:border-gray-200"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              selectedStyle === style.id ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-400"
                            )}>
                              {style.id === 'realistic' && <ImageIcon size={16} />}
                              {style.id === 'pixar' && <Sparkles size={16} />}
                              {style.id === 'anime' && <Film size={16} />}
                              {style.id === 'cyberpunk' && <Target size={16} />}
                              {style.id === 'cinematic' && <Clapperboard size={16} />}
                              {style.id === 'oil-painting' && <Anchor size={16} />}
                              {style.id === 'whiteboard' && <FileSpreadsheet size={16} />}
                              {style.id === 'chalkboard' && <PenTool size={16} />}
                              {style.id === 'stickman' && <UserCheck size={16} />}
                              {style.id === 'sketchnote' && <Save size={16} />}
                              {style.id === 'hand-drawn' && <Edit3 size={16} />}
                              {style.id === 'anthropomorphism' && <Ghost size={16} />}
                            </div>
                            <span className="font-bold text-[10px] leading-tight">{style.name}</span>
                            <div className="absolute inset-0 bg-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[10px] text-purple-400 italic font-medium">
                        * Remix sẽ cập nhật toàn bộ Prompt dựa trên phong cách mới nhưng vẫn giữ nguyên nội dung cốt truyện.
                      </p>
                    </div>

                    <div className="p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Mic size={18} className="text-emerald-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-600">Giọng đọc đồng nhất (Consistent Voice)</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {VOICES.map((voice) => (
                          <button
                            key={voice.id}
                            onClick={() => setSelectedVoice(voice.id)}
                            className={cn(
                              "p-4 rounded-xl border text-left transition-all relative group",
                              selectedVoice === voice.id 
                                ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/10" 
                                : "bg-white/50 border-gray-100 hover:border-gray-200"
                            )}
                          >
                            {analysis?.suggestedVoice === voice.id && (
                              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">Gợi ý</span>
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm">{voice.name}</span>
                              <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                                voice.gender === 'Nam' ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                              )}>
                                {voice.gender}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 mb-1 font-medium">{voice.tone}</p>
                            <p className="text-[9px] text-gray-400 italic leading-tight">{voice.suitable}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 bg-amber-50/30 rounded-2xl border border-amber-100">
                      <div className="flex items-center gap-2 mb-3">
                        <Music size={18} className="text-amber-600" />
                        <h4 className="text-sm font-bold uppercase tracking-wider text-amber-600">Âm thanh & Nhạc nền (Audio Style)</h4>
                      </div>
                      <p className="text-sm text-amber-900 leading-relaxed">
                        {activeTab === 'original' && originalAnalysis ? originalAnalysis.audioStyle : analysis.audioStyle}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Character Consistency Section */}
                {analysis?.characters && analysis.characters.length > 0 && (
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <UserCheck size={20} />
                      </div>
                      <h3 className="text-2xl font-bold">Đồng nhất nhân vật (Character Consistency)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {analysis.characters.map((char, idx) => (
                        <div key={idx} className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-lg text-blue-600">{char.name}</h4>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleGenerateCharacterImage(char.name, char.visualPrompt)}
                                disabled={isGeneratingCharacterImage === char.name}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                  characterImages[char.name]
                                    ? "bg-blue-600 text-white"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                )}
                              >
                                {isGeneratingCharacterImage === char.name ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Sparkles size={14} />
                                )}
                                <span>{characterImages[char.name] ? 'Tạo lại' : 'Tạo ảnh mẫu'}</span>
                              </button>
                              {characterImages[char.name] && (
                                <button
                                  onClick={() => downloadCharacterImage(char.name)}
                                  className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                                  title="Tải về ảnh nhân vật"
                                >
                                  <Download size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">{char.description}</p>
                          {characterImages[char.name] && (
                            <div className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-black/5 shadow-inner bg-gray-100">
                              <img 
                                src={characterImages[char.name]} 
                                alt={char.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                            <p className="text-[10px] text-blue-400 font-mono leading-tight italic">
                              {char.visualPrompt}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Scenes Breakdown */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Film size={20} />
                      </div>
                      <h3 className="text-2xl font-bold">Chi tiết phân cảnh {activeTab === 'upgraded' ? "Nâng cấp" : ""}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full uppercase">
                        {(activeTab === 'original' && originalAnalysis ? originalAnalysis.scenes.length : analysis.scenes.length)} Phân cảnh
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        Ước tính: {getEstimatedDuration(activeTab === 'original' && originalAnalysis ? originalAnalysis.scenes.length : analysis.scenes.length)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(activeTab === 'original' && originalAnalysis ? originalAnalysis.scenes : analysis.scenes).map((scene, idx) => (
                      <div key={idx} className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden group">
                        <div className="p-6 sm:p-8">
                          <div className="flex flex-col sm:flex-row gap-6">
                            <div className="sm:w-24 flex-shrink-0">
                              <div className="text-2xl font-black text-gray-200 mb-1">{(idx + 1).toString().padStart(2, '0')}</div>
                              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">
                                {scene.timestamp}
                              </div>
                            </div>
                            <div className="flex-1 space-y-6">
                              {editingSceneIdx === idx ? (
                                <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-emerald-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-emerald-700 flex items-center gap-2">
                                      <Edit3 size={18} />
                                      Đang chỉnh sửa phân cảnh {idx + 1}
                                    </h4>
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => setEditingSceneIdx(null)}
                                        className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700"
                                      >
                                        Hủy
                                      </button>
                                      <button 
                                        onClick={handleSaveScene}
                                        className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-sm hover:bg-emerald-700"
                                      >
                                        <Save size={14} />
                                        Lưu thay đổi
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase text-gray-400">Mô tả phân cảnh</label>
                                      <input 
                                        type="text" 
                                        value={tempScene?.description || ''} 
                                        onChange={(e) => setTempScene(prev => prev ? {...prev, description: e.target.value} : null)}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase text-gray-400">Chi tiết hình ảnh</label>
                                      <textarea 
                                        rows={2}
                                        value={tempScene?.visualDetail || ''} 
                                        onChange={(e) => setTempScene(prev => prev ? {...prev, visualDetail: e.target.value} : null)}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold uppercase text-gray-400">Lời thoại (Voiceover)</label>
                                      <textarea 
                                        rows={2}
                                        value={tempScene?.voiceoverText || ''} 
                                        onChange={(e) => setTempScene(prev => prev ? {...prev, voiceoverText: e.target.value} : null)}
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-[10px] font-bold uppercase text-gray-400">Image Prompt</label>
                                        <textarea 
                                          rows={3}
                                          value={tempScene?.imagePrompt || ''} 
                                          onChange={(e) => setTempScene(prev => prev ? {...prev, imagePrompt: e.target.value} : null)}
                                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold uppercase text-gray-400">Full Video Prompt</label>
                                        <textarea 
                                          rows={3}
                                          value={tempScene?.fullVideoPrompt || ''} 
                                          onChange={(e) => setTempScene(prev => prev ? {...prev, fullVideoPrompt: e.target.value} : null)}
                                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="font-bold text-lg">{scene.description}</h4>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleStartEditScene(scene, idx)}
                                          className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                                          title="Chỉnh sửa phân cảnh này"
                                        >
                                          <Edit3 size={14} />
                                        </button>
                                        {scene.voiceoverText && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleGenerateSpeech(scene.voiceoverText, idx)}
                                          disabled={isGeneratingSpeech === `scene-${idx}-${selectedVoice}`}
                                          className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                            playingAudio === `scene-${idx}-${selectedVoice}`
                                              ? "bg-emerald-600 text-white"
                                              : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                          )}
                                        >
                                          {isGeneratingSpeech === `scene-${idx}-${selectedVoice}` ? (
                                            <Loader2 size={14} className="animate-spin" />
                                          ) : playingAudio === `scene-${idx}-${selectedVoice}` ? (
                                            isPaused ? <Play size={14} /> : <Pause size={14} />
                                          ) : (
                                            <Mic size={14} />
                                          )}
                                          <span>
                                            {isGeneratingSpeech === `scene-${idx}-${selectedVoice}` 
                                              ? 'Đang tạo...' 
                                              : playingAudio === `scene-${idx}-${selectedVoice}` 
                                                ? (isPaused ? 'Tiếp tục' : 'Tạm dừng') 
                                                : 'Nghe thử'}
                                          </span>
                                        </button>

                                        {generatedAudios[`scene-${idx}-${selectedVoice}`] && (
                                          <button
                                            onClick={() => downloadAudio(idx)}
                                            className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                                            title="Tải về file MP3"
                                          >
                                            <Download size={14} />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-500 text-sm leading-relaxed">{scene.visualDetail}</p>
                                {scene.voiceoverText && (
                                  <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 italic text-sm text-gray-600">
                                    "{scene.voiceoverText}"
                                  </div>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Image Prompt */}
                                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group/prompt">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        <ImageIcon size={14} />
                                        <span>Image Prompt (Midjourney)</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleGenerateImage(scene.imagePrompt, idx)}
                                          disabled={isGeneratingImage === `scene-${idx}`}
                                          className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                                            generatedImages[`scene-${idx}`]
                                              ? "bg-blue-600 text-white"
                                              : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                                          )}
                                        >
                                          {isGeneratingImage === `scene-${idx}` ? (
                                            <Loader2 size={10} className="animate-spin" />
                                          ) : (
                                            <Sparkles size={10} />
                                          )}
                                          <span>{generatedImages[`scene-${idx}`] ? 'Tạo lại' : 'Tạo ảnh'}</span>
                                        </button>
                                        {generatedImages[`scene-${idx}`] && (
                                          <button
                                            onClick={() => downloadSceneImage(idx)}
                                            className="p-1.5 rounded-lg bg-white/80 text-gray-600 hover:bg-white transition-all shadow-sm"
                                            title="Tải về ảnh"
                                          >
                                            <Download size={12} />
                                          </button>
                                        )}
                                        <button 
                                          onClick={() => copyToClipboard(scene.imagePrompt, `img-${idx}`)}
                                          className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-emerald-600"
                                        >
                                          {copiedIndex === `img-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-gray-600 font-mono line-clamp-4 group-hover/prompt:line-clamp-none transition-all mb-4">
                                      {scene.imagePrompt}
                                    </p>
                                    {generatedImages[`scene-${idx}`] && (
                                      <div className="relative aspect-[9/16] max-w-[240px] mx-auto rounded-xl overflow-hidden border border-black/5 shadow-inner bg-gray-200">
                                        <img 
                                          src={generatedImages[`scene-${idx}`]} 
                                          alt={`Storyboard scene ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                      </div>
                                    )}
                                  </div>

                                {/* Full Video Prompt */}
                                <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100 group/prompt">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest">
                                      <Film size={14} />
                                      <span>Full Video Prompt (Motion + Audio + VO)</span>
                                    </div>
                                    <button 
                                      onClick={() => copyToClipboard(scene.fullVideoPrompt, `vid-${idx}`)}
                                      className="p-1.5 hover:bg-white rounded-lg transition-colors text-emerald-400 hover:text-emerald-600"
                                    >
                                      {copiedIndex === `vid-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                  </div>
                                  <p className="text-xs text-emerald-900 font-mono leading-relaxed line-clamp-4 group-hover/prompt:line-clamp-none transition-all">
                                    {scene.fullVideoPrompt}
                                  </p>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* SEO Metadata Block */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-bold flex items-center gap-2">
                        <Target size={20} className="text-emerald-600" />
                        Tối ưu SEO (Mô tả & Hashtags)
                      </h4>
                      <button
                        onClick={handleRegenerateSEO}
                        disabled={isGeneratingSEO}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        {isGeneratingSEO ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {isGeneratingSEO ? 'Đang tạo...' : 'Tạo lại nội dung khác'}
                      </button>
                    </div>

                    {/* Meta/Description Card */}
                    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden p-6 sm:p-8">
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="sm:w-24 flex-shrink-0">
                          <div className="text-2xl font-black text-gray-200 mb-1">
                            {((activeTab === 'original' && originalAnalysis ? originalAnalysis.scenes.length : analysis.scenes.length) + 1).toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">
                            Mô tả
                          </div>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 text-lg">Mô tả video hấp dẫn</h4>
                            <button
                              onClick={() => copyToClipboard(analysis?.videoDescription || '', 'desc')}
                              className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              {copiedIndex === 'desc' ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          </div>
                          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {activeTab === 'original' && originalAnalysis ? originalAnalysis.videoDescription : analysis.videoDescription || "Chưa có mô tả video. Vui lòng bấm 'Tạo lại nội dung khác'."}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Hashtags Card */}
                    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden p-6 sm:p-8">
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="sm:w-24 flex-shrink-0">
                          <div className="text-2xl font-black text-gray-200 mb-1">
                            {((activeTab === 'original' && originalAnalysis ? originalAnalysis.scenes.length : analysis.scenes.length) + 2).toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block">
                            Hashtags
                          </div>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 text-lg">Hashtags chuẩn SEO (Vie & Eng)</h4>
                            <button
                              onClick={() => {
                                const tags = activeTab === 'original' && originalAnalysis ? originalAnalysis.hashtags : analysis.hashtags;
                                copyToClipboard(tags ? tags.map(t => `#${t}`).join(' ') : '', 'tags')
                              }}
                              className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              {copiedIndex === 'tags' ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(activeTab === 'original' && originalAnalysis ? originalAnalysis.hashtags : analysis.hashtags)?.map((tag, idx) => (
                              <span key={idx} className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-sm font-medium">
                                #{tag.replace(/^#/, '')}
                              </span>
                            )) || <span className="text-gray-500 italic text-sm">Chưa có hashtags. Vui lòng bấm 'Tạo lại nội dung khác'.</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Thumbnails Generation */}
                    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden p-6 sm:p-8">
                      <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                              <ImageIcon size={20} />
                            </div>
                            <h4 className="font-bold text-gray-900 text-lg">Thumbnail Recommendation</h4>
                          </div>
                          <button
                            onClick={handleRegenerateThumbnails}
                            disabled={isGeneratingThumbnails}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                          >
                            {isGeneratingThumbnails ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {isGeneratingThumbnails ? 'Đang tạo...' : 'Tạo Thumbnail'}
                          </button>
                        </div>
                        
                        {(activeTab === 'original' && originalAnalysis ? originalAnalysis.thumbnailPrompts : analysis.thumbnailPrompts)?.length ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {(activeTab === 'original' && originalAnalysis ? originalAnalysis.thumbnailPrompts : analysis.thumbnailPrompts).map((prompt, idx) => (
                              <div key={idx} className="flex flex-col gap-3">
                                <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block w-fit">
                                  Option {idx + 1}
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-700 relative group">
                                  <button
                                    onClick={() => copyToClipboard(prompt, `thumb-${idx}`)}
                                    className="absolute top-2 right-2 p-1.5 bg-white text-gray-400 hover:text-emerald-600 rounded drop-shadow opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    {copiedIndex === `thumb-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                                  </button>
                                  {prompt}
                                </div>
                                <div className="mt-2">
                                  {generatedImages[`thumb-${idx}`] ? (
                                    <div className="relative rounded-xl overflow-hidden shadow-sm aspect-video group">
                                      <img src={generatedImages[`thumb-${idx}`]} alt="Generated Thumbnail" className="w-full h-full object-cover" />
                                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={() => {
                                            const a = document.createElement('a');
                                            a.href = generatedImages[`thumb-${idx}`];
                                            a.download = `thumbnail_op${idx+1}.png`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                          }}
                                          className="text-white text-xs flex items-center gap-1 hover:text-emerald-300"
                                        >
                                          <Download size={14} /> Tải xuống
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => generateSceneImage(prompt, `thumb-${idx}`)}
                                      disabled={isGeneratingImage === `thumb-${idx}`}
                                      className="w-full py-2 flex items-center justify-center gap-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                                    >
                                      {isGeneratingImage === `thumb-${idx}` ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                                      Xem trước ảnh
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic text-sm p-4 bg-gray-50 rounded-xl text-center border border-gray-100">
                            Chưa có gợi ý thumbnail. Bấm "Tạo Thumbnail" để AI sáng tạo ý tưởng cho bạn.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  </div>
                </section>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-8">
                {/* Audience & Hooks */}
                <section className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-600 mb-3">
                      <Target size={18} />
                      <h4 className="text-sm font-bold uppercase tracking-wider">Đối tượng mục tiêu</h4>
                    </div>
                    <p className="text-gray-700 font-medium">
                      {activeTab === 'original' && originalAnalysis ? originalAnalysis.targetAudience : analysis.targetAudience}
                    </p>
                  </div>
                  <hr className="border-gray-100" />
                  <div>
                    <div className="flex items-center gap-2 text-emerald-600 mb-4">
                      <Anchor size={18} />
                      <h4 className="text-sm font-bold uppercase tracking-wider">Key Hooks (Điểm nhấn)</h4>
                    </div>
                    <ul className="space-y-3">
                      {(activeTab === 'original' && originalAnalysis ? originalAnalysis.keyHooks : analysis.keyHooks).map((hook, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-600">
                          <ChevronRight size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{hook}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                {/* Character Consistency Guide */}
                <section className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-900/20">
                  <div className="flex items-center gap-2 mb-6">
                    <UserCheck size={20} />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Hướng dẫn đồng nhất nhân vật</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-700/50 rounded-2xl border border-blue-500/30">
                      <h5 className="text-xs font-bold uppercase mb-2 text-blue-200">Bước 1: Truy cập Flow</h5>
                      <p className="text-xs leading-relaxed opacity-90">
                        Mở công cụ Flow tại: <a href="https://labs.google/fx/vi/tools/flow" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-white text-blue-100">labs.google/fx/vi/tools/flow</a>
                      </p>
                    </div>
                    <div className="p-4 bg-blue-700/50 rounded-2xl border border-blue-500/30">
                      <h5 className="text-xs font-bold uppercase mb-2 text-blue-200">Bước 2: Tạo nhân vật chuẩn</h5>
                      <p className="text-xs leading-relaxed opacity-90">
                        Tạo dự án mới, sao chép đoạn <strong>Character Reference</strong> từ phần tổng quan và dán vào để tạo hình nhân vật cố định.
                      </p>
                    </div>
                    <div className="p-4 bg-blue-700/50 rounded-2xl border border-blue-500/30">
                      <h5 className="text-xs font-bold uppercase mb-2 text-blue-200">Bước 3: Thiết lập nhân vật</h5>
                      <p className="text-xs leading-relaxed opacity-90">
                        Kéo hình nhân vật vừa tạo vào biểu tượng <strong>Hình người</strong> ở thanh công cụ bên trái, sau đó dán Prompt của cảnh đầu tiên vào.
                      </p>
                    </div>
                    <div className="p-4 bg-blue-700/50 rounded-2xl border border-blue-500/30">
                      <h5 className="text-xs font-bold uppercase mb-2 text-blue-200">Bước 4: Tạo Video (Veo 3 on Flow)</h5>
                      <p className="text-xs leading-relaxed opacity-90">
                        Sử dụng tính năng <strong>Image-to-Video</strong>. Tải ảnh nhân vật tham chiếu lên, sau đó dán <strong>Full Video Prompt</strong>. AI đã được nạp sẵn <em>Identity Anchor</em> để giữ nguyên nhân vật từ ảnh sang video.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Improvements */}
                <section className="bg-emerald-900 text-white p-8 rounded-3xl shadow-xl shadow-emerald-900/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles size={80} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={20} className="text-emerald-400" />
                        <h4 className="text-sm font-bold uppercase tracking-wider">
                          {isUpgraded ? "Chiến lược Nâng cấp đã thực hiện" : "Lộ trình Nâng cấp dự kiến"}
                        </h4>
                      </div>
                    </div>

                    <div className="mb-6 p-4 bg-emerald-800/20 rounded-2xl border border-emerald-700/30">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">Thời lượng mục tiêu (Target Duration)</h5>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {[
                          { id: 'auto', label: 'Tự động' },
                          { id: '30s', label: '30s' },
                          { id: '60s', label: '60s' },
                          { id: '2m', label: '2 Phút' },
                          { id: '3m', label: '3 Phút' },
                          { id: '5m', label: '5 Phút' },
                        ].map((d) => (
                          <button
                            key={d.id}
                            onClick={() => setTargetDuration(d.id)}
                            className={cn(
                              "px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                              targetDuration === d.id 
                                ? "bg-emerald-500 border-emerald-400 text-white shadow-sm" 
                                : "bg-emerald-900/50 border-emerald-800 text-emerald-400 hover:bg-emerald-800"
                            )}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[9px] text-emerald-500/70 italic">
                        * Nếu chọn thời lượng dài hơn bản gốc, AI sẽ tự phóng tác và sáng tạo thêm nội dung để đạt mục tiêu.
                      </p>
                    </div>

                    <div className="flex justify-center mb-6">
                      <button
                        onClick={handleUpgrade}
                        disabled={upgrading}
                        className={cn(
                          "flex items-center gap-2 px-8 py-3 text-white text-sm font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 w-full justify-center",
                          isUpgraded ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-500 hover:bg-amber-400"
                        )}
                      >
                        {upgrading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        <span>{upgrading ? 'Đang nâng cấp...' : isUpgraded ? 'Nâng cấp mở rộng thêm' : 'Bắt đầu nâng cấp toàn diện'}</span>
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="p-4 bg-emerald-800/40 rounded-2xl border border-emerald-700/30">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">Phân tích & Đề xuất</h5>
                        <ul className="space-y-4">
                          {(activeTab === 'original' && originalAnalysis ? originalAnalysis.improvementSuggestions : analysis.improvementSuggestions).map((suggestion, i) => (
                            <li key={i} className="flex gap-3 text-sm leading-relaxed text-emerald-50/90">
                              <div className="w-5 h-5 rounded-full bg-emerald-800 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 border border-emerald-700">
                                {i + 1}
                              </div>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {!isUpgraded && (
                        <div className="bg-emerald-950/50 p-4 rounded-2xl border border-emerald-800/30">
                          <p className="text-[10px] text-emerald-400/80 italic leading-relaxed">
                            * Nhấn nút nâng cấp để AI tự động viết lại kịch bản, tối ưu lời thoại và nâng cấp toàn bộ prompt hình ảnh theo tiêu chuẩn Viral.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Quick Actions */}
                <div className="flex justify-center">
                  <button 
                    onClick={handleViewOriginal}
                    className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-2xl w-full max-w-[200px] hover:border-emerald-500 transition-colors group shadow-sm"
                  >
                    <div className="text-gray-400 group-hover:text-emerald-600 mb-1">
                      <ExternalLink size={24} />
                    </div>
                    <span className="text-xs font-bold text-gray-500 group-hover:text-gray-900 uppercase tracking-widest text-center">Xem Video Gốc</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-12 border-t border-black/5 mt-12 mb-20 fade-in animate-in">
              <button
                onClick={handleNewProject}
                className="flex items-center gap-2 px-10 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all shadow-xl hover:shadow-gray-900/20 active:scale-95"
              >
                <PlusCircle size={20} />
                Phân tích video/kịch bản khác
              </button>
            </div>
          </div>
        </div>
      )}

        {!loading && !analysis && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: <Target className="text-blue-500" />, title: "Phân tích kịch bản", desc: "Trích xuất lời thoại và cấu trúc nội dung chính xác." },
              { icon: <ImageIcon className="text-purple-500" />, title: "Prompt AI", desc: "Tạo prompt cho Midjourney, Stable Diffusion từ phân cảnh." },
              { icon: <Sparkles className="text-emerald-500" />, title: "Tối ưu hóa", desc: "Gợi ý cách cải thiện lượt xem và giữ chân người dùng." }
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                <div className="mb-4">{item.icon}</div>
                <h4 className="font-bold mb-2">{item.title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="mt-20 border-t border-black/5 py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center space-y-4">
          <div className="space-y-2">
            <p className="text-gray-900 font-bold">Made by Hữu Nghĩa GV</p>
            <p className="text-gray-600 text-sm">Liên hệ công việc Hotline/Zalo: <a href="https://zalo.me/0707155117" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">0707.155.117</a></p>
            <p className="text-gray-600 text-sm">
              Cộng đồng tự học AI hàng ngày: 
              <a href="https://zalo.me/g/xdhbas545" target="_blank" rel="noopener noreferrer" className="ml-1 text-emerald-600 hover:underline font-medium inline-flex items-center gap-1">
                https://zalo.me/g/xdhbas545
                <ExternalLink size={12} />
              </a>
            </p>
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-widest pt-4">© 2026 Video Insight Pro • Powered by Gemini 3 Flash & FFmpeg</p>
        </div>
      </footer>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Lịch sử phân tích</h3>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Lưu lại 10 phiên làm việc gần nhất</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
              {history.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                    <Clock size={32} />
                  </div>
                  <p className="text-gray-500 font-medium">Chưa có lịch sử phân tích nào.</p>
                  <p className="text-sm text-gray-400 mt-1">Các kịch bản bạn phân tích sẽ xuất hiện tại đây.</p>
                </div>
              ) : (
                history.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="group p-4 bg-white border border-gray-100 rounded-2xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors shrink-0">
                        <Clapperboard size={24} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(item.timestamp).toLocaleString('vi-VN')}
                          </span>
                          {item.isUpgraded && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
                              Đã nâng cấp
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Xóa khỏi lịch sử"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowHistory(false)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
