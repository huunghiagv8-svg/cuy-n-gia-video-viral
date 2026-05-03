import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface Scene {
  timestamp: string;
  description: string;
  visualDetail: string;
  imagePrompt: string;
  fullVideoPrompt: string;
  voiceoverText: string;
}

export interface Character {
  name: string;
  description: string;
  visualPrompt: string;
}

export interface ContentTheme {
  title: string;
  description: string;
  angle: string;
}

export interface VideoAnalysis {
  title: string;
  summary: string;
  originalScript: string;
  characterReference: string;
  characters: Character[];
  targetAudience: string;
  keyHooks: string[];
  suggestedVoice: string;
  audioStyle: string;
  detectedStyle: string;
  purpose: string;
  painPoints: string[];
  viralityReason: string;
  nextThemes: ContentTheme[];
  contentCompleteness: string;
  strengths: string[];
  weaknesses: string[];
  scenes: Scene[];
  improvementSuggestions: string[];
  videoDescription: string;
  hashtags: string[];
  thumbnailPrompts: string[];
}

export async function generateSpeech(text: string, voice: string = 'Puck'): Promise<{ data: string }> {
  // Using the latest Gemini 3.1 Flash TTS model
  const modelName = "gemini-3.1-flash-tts-preview";
  
  const splitIntoChunks = (str: string, maxLength: number = 400): string[] => {
    // Better regex to split by end of sentences or semicolons for natural breaks
    const sentences = str.match(/[^.!?\n;]+[.!?\n;]+|\s*[^.!?\n;]+$/g) || [str];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  };

  const chunks = text.length > 800 ? splitIntoChunks(text, 600) : [text];
  const audioDataParts: Uint8Array[] = [];

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Delay to prevent rate limiting
      const delay = i === 0 ? 0 : 600;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      let retryCount = 0;
      const maxRetries = 3;
      let success = false;
      let base64Audio = "";

      while (retryCount <= maxRetries && !success) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: chunk }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice as any },
                },
              },
            }
          });

          const parts = response.candidates?.[0]?.content?.parts;
          const audioPart = parts?.find((p: any) => p.inlineData);
          base64Audio = audioPart?.inlineData?.data;
          
          if (base64Audio) {
            success = true;
          } else {
            throw new Error("Empty audio response");
          }
        } catch (err: any) {
          const errStatus = err.message || "";
          if (retryCount < maxRetries && (errStatus.includes("500") || errStatus.includes("Internal") || errStatus.includes("429"))) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 500));
          } else {
            throw err;
          }
        }
      }

      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        audioDataParts.push(bytes);
      }
    }

    if (audioDataParts.length === 0) throw new Error("Không nhận được dữ liệu âm thanh từ AI");

    const totalLength = audioDataParts.reduce((acc, part) => acc + part.length, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const part of audioDataParts) {
      combinedBuffer.set(part, offset);
      offset += part.length;
    }

    let combinedBinary = "";
    const CHUNK_SIZE = 0x8000;
    for (let i = 0; i < combinedBuffer.length; i += CHUNK_SIZE) {
      combinedBinary += String.fromCharCode.apply(null, Array.from(combinedBuffer.subarray(i, i + CHUNK_SIZE)));
    }
    const combinedBase64 = btoa(combinedBinary);

    return { data: combinedBase64 };
  } catch (error: any) {
    console.error("TTS Error:", error);
    let message = error.message;
    if (message.toLowerCase().includes("quota") || message.includes("429")) {
      message = "Hạn mức (Quota) Gemini của bạn đã hết. Hãy thử lại sau 1 phút hoặc kiểm tra API Key.";
    } else if (message.includes("404") || message.toLowerCase().includes("not found")) {
      message = "Mô hình tạo giọng nói hiện đang được bảo trì hoặc không khả dụng (Lỗi 404).";
    }
    throw new Error(`Lỗi tạo giọng nói: ${message}`);
  }
}

export async function generateImage(prompt: string, characterPrompt?: string, imageRefBase64?: string, style: string = 'realistic'): Promise<string> {
  try {
    const parts: any[] = [];

    // If we have an image reference, add it as the first part for visual guidance
    if (imageRefBase64) {
      parts.push({
        inlineData: {
          data: imageRefBase64,
          mimeType: "image/png"
        }
      });
    }

    const fullPrompt = characterPrompt 
      ? `CHARACTER REFERENCE DESCRIPTION: ${characterPrompt}.
         ${imageRefBase64 ? "Use the provided image as the PRIMARY VISUAL REFERENCE for the face and appearance." : ""}
         Pay extremely close attention to the character's face, hair color/style, clothing, and unique features.
         SCENE DESCRIPTION: ${prompt}. 
         Style: ${style}.
         The character should be performing the action described in the scene while maintaining 100% visual identity with the reference. 
         Ensure the character in this scene is the EXACT same person as in the reference. Do not change their face or age.`
      : `Style: ${style}. Scene: ${prompt}`;

    parts.push({ text: fullPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: parts }],
      config: { imageConfig: { aspectRatio: "9:16" } },
    });
    
    // Find image part
    let base64Image = "";
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        base64Image = part.inlineData.data;
        break;
      }
    }
    
    if (!base64Image) throw new Error("Không thể tạo ảnh minh họa");
    return `data:image/png;base64,${base64Image}`;
  } catch (error: any) {
    console.error("Image Gen Error:", error);
    let message = error.message;
    if (message.toLowerCase().includes("quota") || message.includes("429")) {
      message = "Hạn mức (Quota) Gemini của bạn đã hết. Hãy thử lại sau 1 phút hoặc nâng cấp API Key trong Settings.";
    }
    throw new Error(`Lỗi tạo ảnh: ${message}`);
  }
}

export async function analyzeVideo(
  videoUrl?: string, 
  videoBase64?: string, 
  mimeType?: string,
  targetTool: 'veo' | 'sora' | 'grok' | 'grok6' = 'veo',
  scriptContent?: string,
  visualStyle?: string
): Promise<VideoAnalysis> {
  const model = "gemini-3-flash-preview";
  const toolSpecs = {
    veo: "Veo 3 (Tối đa 8s/cảnh, hỗ trợ âm thanh và voiceover tích hợp)",
    sora: "Sora 2 (10s-15s/cảnh, hỗ trợ âm thanh và voiceover tích hợp)",
    grok: "Grok (Tối đa 10s/cảnh, hỗ trợ âm thanh và voiceover tích hợp)",
    grok6: "Grok (Tối đa 6s/cảnh, hỗ trợ âm thanh và voiceover tích hợp)"
  };

  const coreInstructions = `
      Nhiệm vụ của bạn là phân tích ${scriptContent ? 'kịch bản' : 'video'} để tái tạo lại hoàn toàn bằng AI sử dụng công cụ: ${toolSpecs[targetTool]}.
      
      MỤC TIÊU PHONG CÁCH (VISUAL STYLE):
      - Nếu có PHONG CÁCH BẮT BUỘC cung cấp bên dưới, bạn PHẢI áp dụng nó.
      - TRƯỜNG HỢP PHÂN TÍCH VIDEO: Nếu không có phong cách bắt buộc, bạn PHẢI phân tích cực kỳ chính xác phong cách mỹ thuật của video gốc (ví dụ: Realistic, Animation, 3D, Anime, Minimalist, Whiteboard, Chalkboard, Anthropomorphism...) và áp dụng phong cách đó vào toàn bộ imagePrompt và fullVideoPrompt để bản tái tạo giống video gốc nhất có thể. Đưa tên phong cách này vào trường "visualStyle".
      
      ${visualStyle ? `PHONG CÁCH MỸ THUẬT BẮT BUỘC (FORCED STYLE): ${visualStyle}.` : ""}

      YÊU CẦU CHIẾN THUẬT SIÊU CẤP:
      1. PHÂN TÍCH NỘI DUNG CHIỀU SÂU: Xác định mục đích, đào sâu nỗi đau khách hàng và tính đầy đủ. Đặc biệt phân tích lý do tại sao video này có khả năng viral (viralityReason).
      2. GỢI Ý CHỦ ĐỀ TIẾP THEO (NEXT THEMES): Dựa trên video gốc đã "win", hãy gợi ý 5-10 chủ đề/khía cạnh mới (nextThemes) để phát triển kênh bền vững, đánh sâu vào các angle khác nhau hoặc các nỗi đau liên quan của cùng tệp khách hàng.
      3. ĐỒNG NHẤT NHÂN VẬT: Trích xuất ngoại hình nhân vật chi tiết. Mặc định tất cả các nhân vật là người Việt Nam (Vietnamese ethnicity).
      3. TỐI ƯU NHỊP ĐỘ (PACING & PUNCTUATION): Lời thoại (voiceoverText) PHẢI lấp đầy ~80% thời lượng cảnh (${targetTool === 'grok6' ? '5-6s' : '8-15s'} tùy công cụ). BẮT BUỘC sử dụng đầy đủ dấu câu (phẩy, chấm, chấm lửng "...") để tạo nhịp nghỉ cho hệ thống đọc giọng nói (TTS). Tuyệt đối không viết một dải chữ dài không có dấu ngắt.
      4. IDENTITY ANCHOR: Mọi "Full Video Prompt" PHẢI bắt đầu bằng: "Maintaining the exact identity, clothing, and traits of the person from the reference image, they [describe movement]". Điều này là bắt buộc để công cụ AI không làm biến đổi nhân vật.
      5. NHẠC NỀN ĐỒNG NHẤT & FADE LOGIC: Một mô tả nhạc nền (Theme BGM) phải đồng nhất trong mọi prompt video. Áp dụng kỹ thuật: Cảnh 1 bắt đầu bằng "BGM fades in from silence". Các cảnh giữa giữ nhạc liên tục. Cảnh cuối kết thúc bằng "BGM fades out to silence".
      6. AN TOÀN & KHÔNG CHỮ: Không người nổi tiếng, không bạo lực. Tuyệt đối không có chữ trên màn hình (thêm "No text, no signs, no letters, no captions").
      7. ĐỒNG BỘ KỊCH BẢN: originalScript khớp 100% với lời thoại các cảnh.
      8. Chia cảnh chuẩn thời lượng: ${targetTool === 'veo' ? '8s' : targetTool === 'grok' ? '10s' : targetTool === 'grok6' ? '6s' : '10-15s'}. Phải tạo đủ số lượng cảnh (20-50 cảnh) cho kịch bản dài.
      9. AN TOÀN & KHÔNG CHỮ: Không người nổi tiếng, không bạo lực. Tuyệt đối không có chữ trên màn hình (thêm "No text, no signs, no letters, no captions").
      10. TRÁNH TRẺ VỊ THÀNH NIÊN (SAFETY BYPASS): Để tránh kích hoạt bộ lọc bảo mật, bạn PHẢI mô tả toàn bộ các nhân vật trẻ tuổi là "Young Adult" (Thanh niên/Người trẻ) hoặc "University Student" (Sinh viên), độ tuổi tối thiểu là 18. Tuyệt đối không dùng các từ như "teenager", "minor", "child", "school student" trong prompt. 
      11. ẨN DỤ NỖI NHỚ (METAPHORIC NOSTALGIA): Nếu kịch bản nhắc đến "đứa trẻ bên trong" hoặc "bản thân lúc nhỏ", TUYỆT ĐỐI KHÔNG dùng từ chỉ tuổi tác cụ thể (7-year-old, child). Hãy dùng các cụm từ ẩn dụ như "a smaller, ethereal reflection of her past self", "the innocent essence of her early years", "a younger, blurred silhouette representing her memories".
      12. VOICE OVER INTEGRATION: Bạn PHẢI bao gồm nội dung lời thoại (voiceoverText) tương ứng vào CUỐI của trường "fullVideoPrompt" theo định dạng: Voice-over: "[Nội dung tiếng Việt]". Lưu ý phần lời thoại trong ngoặc kép phải là tiếng Việt để đồng bộ với âm thanh.
      13. Với mỗi phân cảnh, cung cấp: Image Prompt, Full Video Prompt, voiceoverText.
      14. Trả về kết quả bằng tiếng Việt (ngoại trừ prompt AI).`;

  const parts: any[] = [];
  if (videoBase64 && mimeType) {
    parts.push({ inlineData: { data: videoBase64, mimeType: mimeType } });
    parts.push({ text: `Hãy xem video này và phân tích cực kỳ chi tiết. ${coreInstructions}` });
  } else if (videoUrl) {
    parts.push({ text: `Hãy phân tích chi tiết video từ URL sau: ${videoUrl}. ${coreInstructions}` });
  } else if (scriptContent) {
    parts.push({ text: `Hãy phân tích kịch bản sau đây để biến nó thành một video viral triệu view: \n ${scriptContent} \n ${coreInstructions}` });
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts }],
      config: {
        tools: videoBase64 ? [] : [{ googleSearch: {} }],
        toolConfig: (videoBase64 ? undefined : { includeServerSideToolInvocations: true }) as any,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            originalScript: { type: Type.STRING },
            characterReference: { type: Type.STRING },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING }
                },
                required: ["name", "description", "visualPrompt"]
              }
            },
            targetAudience: { type: Type.STRING },
            suggestedVoice: { type: Type.STRING },
            audioStyle: { type: Type.STRING },
            detectedStyle: { type: Type.STRING },
            purpose: { type: Type.STRING },
            painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            viralityReason: { type: Type.STRING },
            nextThemes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  angle: { type: Type.STRING }
                },
                required: ["title", "description", "angle"]
              }
            },
            contentCompleteness: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyHooks: { type: Type.ARRAY, items: { type: Type.STRING } },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            videoDescription: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualDetail: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  fullVideoPrompt: { type: Type.STRING },
                  voiceoverText: { type: Type.STRING }
                },
                required: ["timestamp", "description", "visualDetail", "imagePrompt", "fullVideoPrompt", "voiceoverText"]
              }
            },
            improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "summary", "originalScript", "characterReference", "characters", "scenes", "improvementSuggestions", "targetAudience", "keyHooks", "suggestedVoice", "audioStyle", "detectedStyle", "strengths", "weaknesses", "purpose", "painPoints", "contentCompleteness", "viralityReason", "nextThemes", "hashtags", "videoDescription"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Không nhận được kết quả phân tích");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Analysis Error:", error);
    let message = error.message;
    if (message.toLowerCase().includes("quota") || message.includes("429")) {
      message = "Bạn đã vượt quá hạn mức sử dụng (Quota). Nếu bạn vừa Remix, hãy vào Settings (biểu tượng răng cưa) để thiết lập API Key cá nhân của mình hoặc thử lại sau vài phút.";
    }
    throw new Error(`Lỗi phân tích: ${message}`);
  }
}

export async function upgradeAnalysis(
  currentAnalysis: VideoAnalysis,
  targetTool: 'veo' | 'sora' | 'grok' | 'grok6' = 'veo',
  customInstruction?: string,
  targetDuration: string = 'auto',
  visualStyle?: string
): Promise<VideoAnalysis> {
  const model = "gemini-3.1-pro-preview";
  const durationInstruction = targetDuration !== 'auto' 
    ? `MỤC TIÊU THỜI LƯỢNG MỚI: ${targetDuration}. 
       QUAN TRỌNG: Nếu thời lượng này dài hơn kịch bản gốc, bạn PHẢI phóng tác, sáng tạo thêm nội dung, đào sâu câu chuyện, thêm các tình tiết và phân cảnh mới để đạt đúng thời lượng mục tiêu. Tuyệt đối không được chỉ lặp lại. Phải viết nội dung mới chất lượng.` 
    : "";

  const styleInstruction = visualStyle 
    ? `PHONG CÁCH MỸ THUẬT MỚI (NEW VISUAL STYLE): ${visualStyle}. 
       Bạn PHẢI thay đổi toàn bộ imagePrompt và fullVideoPrompt của các phân cảnh để phù hợp TUYỆT ĐỐI với phong cách "${visualStyle}" này. 
       Xóa bỏ mọi gợi ý về phong cách cũ.` 
    : "";

  const prompt = `
    Bạn là một chuyên gia sáng tạo nội dung Viral và đạo diễn hình ảnh AI hàng đầu. 
    Nhiệm vụ: Nâng cấp bản phân tích video hiện tại thành một phiên bản "Viral & Premium" ĐẲNG CẤP.
    Bản phân tích hiện tại: ${JSON.stringify(currentAnalysis, null, 2)}
    
    ${durationInstruction}
    ${styleInstruction}

    ${customInstruction ? `YÊU CẦU ĐẶC BIỆT TỪ NGƯỜI DÙNG: ${customInstruction}` : `YÊU CẦU CHIẾN LƯỢC NÂNG CẤP SIÊU CẤP (VIRAL MASTERPIECE):
      0. TRIỆT TIÊU NHƯỢC ĐIỂM: Phải giải quyết và xóa sạch mọi NHƯỢC ĐIỂM (Weaknesses) của bản gốc. Bản nâng cấp PHẢI KHÔNG CÒN NHƯỢC ĐIỂM (weaknesses array trả về nên để trống). Biến điểm yếu thành điểm mạnh vượt trội.
      1. ĐỘ SÂU NGÔN TỪ: Kịch bản mới phải cực kỳ sâu sắc, chạm đến Insight và tử huyệt cảm xúc của khách hàng. Sử dụng ngôn từ tinh tế, có sức lay động mạnh mẽ, không hời hợt.
      2. NÂNG CẤP TOÀN DIỆN: Hình ảnh rực rỡ, Cinematic, màu sắc Color Grading đồng nhất, bối cảnh hoành tráng, hiệu ứng chuyển cảnh ảo diệu.
      3. ĐỘ ĐẦY ĐỦ TRUYỆN: Kịch bản hoàn thiện từ Hook đến Call to Action.
      4. ĐỒNG NHẤT NHÂN VẬT: Nhân vật lôi cuốn, dễ nhận diện. Bắt đầu mọi prompt bằng mô tả nhân vật. Mặc định tất cả các nhân vật là người Việt Nam (Vietnamese ethnicity).
      5. CHI TIẾT CẢNH: Chia cảnh theo công cụ ${targetTool.toUpperCase()} (${targetTool === 'veo' ? '8s' : targetTool === 'grok' ? '10s' : targetTool === 'grok6' ? '6s' : '10-15s'}).
      6. ĐỘ ĐỒNG NHẤT TUYỆT ĐỐI (IDENTITY ANCHOR): Trong trường "Full Video Prompt", bạn PHẢI sử dụng kỹ thuật "Anchor Prompting". Mọi mô tả video PHẢI bắt đầu bằng: "Maintaining the exact identity, clothing, and traits of the person from the reference image, they [describe movement]". Điều này là bắt buộc để công cụ AI (Veo/Sora) không làm biến đổi nhân vật.
      7. TỐI ƯU NHÀN RỖI (PACING & PUNCTUATION): Lời thoại (voiceoverText) PHẢI lấp đầy ~80% thời lượng cảnh (VD: ${targetTool === 'grok6' ? '5-6s' : '8-15s'}). BẮT BUỘC sử dụng đầy đủ dấu câu (phẩy, chấm, chấm lửng "...") để tạo nhịp nghỉ cho hệ thống giọng nói (TTS). Tuyệt đối không viết dính chùm.
      8. ĐỒNG NHẤT NHẠC NỀN & FADE LOGIC (BGM FADE IN/OUT): Xác định một phong cách nhạc nền chủ đạo (Theme Music) cho toàn bộ video. Trong phần Full Video Prompt:
         - Phân cảnh đầu tiên: Thêm chỉ thị "BGM starts quiet and fades in to full volume".
         - Các phân cảnh giữa: Nhạc nền duy trì âm lượng ổn định.
         - Phân cảnh cuối cùng: Thêm chỉ thị "BGM fades out slowly to silence".
      9. AN TOÀN & KHÔNG CHỮ (SAFETY & NO TEXT): 
         - Tuyệt đối không tạo nội dung vi phạm chính sách, bạo lực hay người nổi tiếng. Mô tả nhân vật bằng các đặc điểm ngoại hình hư cấu chi tiết thay vì "the man/woman" chung chung.
         - TUYỆT ĐỐI KHÔNG CÓ CHỮ TRÊN MÀN HÌNH (NO TEXT ON SCREEN): Luôn thêm "No text, no signs, no letters, no captions" vào cuối prompt. Biến mọi vật thể có chữ thành vật thể nghệ thuật không chữ.
      10. TRÁNH TRẺ VỊ THÀNH NIÊN (SAFETY BYPASS): Các hệ thống AI chặn tạo hình ảnh trẻ em. Bạn PHẢI ép mọi nhân vật trẻ tuổi về độ tuổi 18-25 bằng cách gọi họ là "Young Adult", "University student", "Fresh graduate". Cấm dùng từ "minor", "teen", "middle school", "adolescent" trong mọi prompt.
      11. ẨN DỤ NỖI NHỚ (METAPHORIC NOSTALGIA): Tuyệt đối không được dùng "7-year-old", "child", "kids" kể cả khi nói về "đứa trẻ bên trong". Hãy dùng cách mô tả ẩn dụ về "hình bóng thu nhỏ" (a small soft-focus figure), "bản thể quá khứ rạng ngời" (her radiant past essence) hoặc "phản chiếu của kỷ niệm" (a reflection of her memories).
      11. VOICE OVER INTEGRATION: Bạn PHẢI bao gồm nội dung lời thoại (voiceoverText) tương ứng vào CUỐI của trường "fullVideoPrompt" theo định dạng: Voice-over: "[Nội dung tiếng Việt]". Lưu ý phải có dấu câu đầy đủ trong lời thoại này.
      12. ĐỘ DÀI TOÀN DIỆN: Nếu kịch bản dài (3-5 phút), PHẢI tạo đủ 20-50 phân cảnh để bao phủ không sót một giây nào. Tuyệt đối không được rút ngắn kịch bản gốc.
      13. GỢI Ý CHỦ ĐỀ TIẾP THEO (NEXT THEMES): Dựa trên video hiện tại, hãy gợi ý 5-10 chủ đề/khía cạnh mới (nextThemes) để phát triển kênh bền vững.
      14. ĐỒNG BỘ KỊCH BẢN TỔNG & NGẮT NGHỈ (TTS OPTIMIZATION): Trường "originalScript" PHẢI được viết lại hoàn toàn để chứa toàn bộ nội dung lồng tiếng của TẤT CẢ các phân cảnh đã mở rộng. "originalScript" phải là một bản thảo kịch bản hoàn chỉnh, mạch lạc, có chấm phẩy, dấu chấm lửng (...) và xuống dòng rõ ràng để tạo nhịp nghỉ tự nhiên khi đọc. Khớp 100% với lời thoại trong từng scene.`}
    
    Yêu cầu đầu ra (JSON): Cung cấp đầy đủ các trường như schema yêu cầu.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            originalScript: { type: Type.STRING },
            characterReference: { type: Type.STRING },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualPrompt: { type: Type.STRING }
                },
                required: ["name", "description", "visualPrompt"]
              }
            },
            targetAudience: { type: Type.STRING },
            suggestedVoice: { type: Type.STRING },
            audioStyle: { type: Type.STRING },
            detectedStyle: { type: Type.STRING },
            purpose: { type: Type.STRING },
            painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            viralityReason: { type: Type.STRING },
            nextThemes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  angle: { type: Type.STRING }
                },
                required: ["title", "description", "angle"]
              }
            },
            contentCompleteness: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyHooks: { type: Type.ARRAY, items: { type: Type.STRING } },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            videoDescription: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  description: { type: Type.STRING },
                  visualDetail: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING },
                  fullVideoPrompt: { type: Type.STRING },
                  voiceoverText: { type: Type.STRING }
                },
                required: ["timestamp", "description", "visualDetail", "imagePrompt", "fullVideoPrompt", "voiceoverText"]
              }
            },
            improvementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "summary", "originalScript", "characterReference", "characters", "scenes", "improvementSuggestions", "targetAudience", "keyHooks", "suggestedVoice", "audioStyle", "detectedStyle", "strengths", "weaknesses", "purpose", "painPoints", "contentCompleteness", "viralityReason", "nextThemes", "hashtags", "videoDescription"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Không nhận được kết quả nâng cấp");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Upgrade Error:", error);
    let message = error.message;
    if (message.toLowerCase().includes("quota") || message.includes("429")) {
      message = "Hạn mức AI của bạn đã hết. Vui lòng kiểm tra lại cấu hình API Key trong phần Settings của dự án Remix.";
    }
    throw new Error(`Lỗi nâng cấp: ${message}`);
  }
}

export async function generateThumbnails(currentAnalysis: VideoAnalysis): Promise<{ thumbnailPrompts: string[] }> {
  const model = "gemini-3.1-pro-preview";
  const prompt = `
    Dựa trên kịch bản video này:
    Tiêu đề: ${currentAnalysis.title}
    Khán giả: ${currentAnalysis.targetAudience}
    Tóm tắt: ${currentAnalysis.summary}
    Các phân cảnh: ${JSON.stringify(currentAnalysis.scenes.map(s => s.description))}
    
    Hãy sáng tạo 3 "Image Prompts" (bằng tiếng Anh, tả thực/cinematic đẹp mắt) để làm ảnh bìa (thumbnail) YouTube/TikTok. 
    Thumbnail cần:
    1. Cực kỳ ấn tượng, giật gân, có yếu tố tò mò.
    2. Focus vào cảm xúc nhân vật hoặc tình huống cao trào.
    3. Cinematic lighting, 8k resolution, highly detailed.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thumbnailPrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["thumbnailPrompts"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Lỗi khi tạo thumbnail prompts");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Thumbnail Error:", error);
    throw new Error(`Lỗi tạo thumbnail: ${error.message}`);
  }
}

export async function regenerateSEO(currentAnalysis: VideoAnalysis): Promise<{ videoDescription: string, hashtags: string[] }> {
  const model = "gemini-3.1-pro-preview";
  const prompt = `
    Dựa trên dữ liệu kịch bản video này:
    Tiêu đề: ${currentAnalysis.title}
    Mục tiêu: ${currentAnalysis.purpose}
    Khán giả: ${currentAnalysis.targetAudience}
    Tóm tắt: ${currentAnalysis.summary}
    
    Hãy tạo một "Mô tả video" (videoDescription) dài khoảng 3-5 câu thật hấp dẫn, giật gân, khơi gợi trí tò mò để đăng lên mạng xã hội (TikTok, Shorts, Reels) kèm lời kêu gọi hành động.
    Và tạo 6 Hashtags (hashtags) chuẩn SEO, kết hợp tiếng Anh và tiếng Việt, liên quan trực tiếp đến nội dung. (bỏ dấu # ở đầu dòng)
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videoDescription: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["videoDescription", "hashtags"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Lỗi khi tạo lại SEO metadata");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("SEO Error:", error);
    throw new Error(`Lỗi tạo SEO: ${error.message}`);
  }
}
