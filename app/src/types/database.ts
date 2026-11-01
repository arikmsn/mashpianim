export type UserType = "creator" | "brand" | "admin";
export type ConnectionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "shipped"
  | "filming"
  | "uploaded"
  | "in_review"
  | "revision_requested"
  | "completed"
  | "cancelled";
export type VideoStatus = "pending" | "approved" | "revision_requested";
export type CreatorLevel = "creator" | "creator_plus" | "on_the_radar";
export type ProductStatus = "active" | "paused" | "deleted";
export type ShippingPolicy = "free" | "paid" | "pickup";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          type: UserType;
          email: string | null;
          phone: string;
          avatar_url: string | null;
          full_name: string;
          created_at: string;
          updated_at: string;
          is_active: boolean;
          onboarding_completed: boolean;
          auth_user_id: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      creator_profiles: {
        Row: {
          id: string;
          user_id: string;
          bio: string | null;
          tiktok_handle: string | null;
          tiktok_followers: number;
          instagram_handle: string | null;
          instagram_followers: number;
          categories: string[];
          level: CreatorLevel;
          hearts: number;
          completed_connections: number;
          intro_video_url: string | null;
          city: string | null;
          date_of_birth: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["creator_profiles"]["Row"], "id" | "hearts" | "completed_connections">;
        Update: Partial<Database["public"]["Tables"]["creator_profiles"]["Insert"]>;
      };
      brand_profiles: {
        Row: {
          id: string;
          user_id: string;
          shop_name: string;
          logo_url: string | null;
          category: string;
          website_url: string | null;
          description: string | null;
          total_credits: number;
          used_credits: number;
        };
        Insert: Omit<Database["public"]["Tables"]["brand_profiles"]["Row"], "id" | "total_credits" | "used_credits">;
        Update: Partial<Database["public"]["Tables"]["brand_profiles"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          image_url: string | null;
          price: number;
          description: string | null;
          shipping_policy: ShippingPolicy;
          shipping_address: string | null;
          status: ProductStatus;
          source_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      connections: {
        Row: {
          id: string;
          creator_id: string;
          brand_id: string;
          product_id: string;
          status: ConnectionStatus;
          created_at: string;
          approved_at: string | null;
          shipped_at: string | null;
          filmed_at: string | null;
          completed_at: string | null;
          ship_deadline: string | null;
          film_deadline: string | null;
          review_deadline: string | null;
          rejection_reason: string | null;
          revision_notes: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["connections"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["connections"]["Insert"]>;
      };
      videos: {
        Row: {
          id: string;
          connection_id: string;
          url: string;
          thumbnail_url: string | null;
          duration_seconds: number | null;
          status: VideoStatus;
          revision_notes: string | null;
          moderation_flags: string[];
          ai_review_result: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["videos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["videos"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          connection_id: string;
          sender_id: string;
          text: string;
          is_system: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      credits: {
        Row: {
          id: string;
          brand_id: string;
          total: number;
          used: number;
          purchased_at: string;
          package_name: string;
        };
        Insert: Omit<Database["public"]["Tables"]["credits"]["Row"], "id" | "purchased_at">;
        Update: Partial<Database["public"]["Tables"]["credits"]["Insert"]>;
      };
      transactions: {
        Row: {
          id: string;
          brand_id: string;
          amount: number;
          credits: number;
          payment_method: string;
          payment_ref: string | null;
          status: "pending" | "completed" | "failed" | "refunded";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["transactions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          data: Record<string, unknown> | null;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at" | "read">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      referrals: {
        Row: {
          id: string;
          referrer_brand_id: string;
          referred_brand_id: string | null;
          code: string;
          status: "pending" | "completed";
          credits_awarded: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["referrals"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["referrals"]["Insert"]>;
      };
      site_content: {
        Row: {
          id: string;
          data: Record<string, string>;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: { id: string; data: Record<string, string>; updated_by?: string | null };
        Update: Partial<{ data: Record<string, string>; updated_by: string | null }>;
      };
      site_settings: {
        Row: {
          id: string;
          data: Record<string, unknown>;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: { id: string; data: Record<string, unknown>; updated_by?: string | null };
        Update: Partial<{ data: Record<string, unknown>; updated_by: string | null }>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_type: UserType;
      connection_status: ConnectionStatus;
      video_status: VideoStatus;
      creator_level: CreatorLevel;
      product_status: ProductStatus;
    };
  };
}
