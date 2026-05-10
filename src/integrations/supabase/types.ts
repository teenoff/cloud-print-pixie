export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      orders: {
        Row: {
          amount_paise: number
          binding: string
          color_mode: string
          copies: number
          created_at: string
          customer_phone: string | null
          file_name: string
          file_size: number
          file_url: string
          id: string
          printed_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          store_uid: string
          user_id: string
        }
        Insert: {
          amount_paise?: number
          binding?: string
          color_mode?: string
          copies?: number
          created_at?: string
          customer_phone?: string | null
          file_name: string
          file_size: number
          file_url: string
          id?: string
          printed_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          store_uid: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          binding?: string
          color_mode?: string
          copies?: number
          created_at?: string
          customer_phone?: string | null
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          printed_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          store_uid?: string
          user_id?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          address_line: string | null
          agent_token: string
          area: string | null
          bw_price: number
          city: string | null
          color_price: number
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          one_pin_price: number
          owner_user_id: string
          phone: string
          pincode: string | null
          printer_name: string | null
          qr_image_path: string | null
          road: string | null
          spiral_price: number
          store_uid: string
          tape_price: number
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          address_line?: string | null
          agent_token?: string
          area?: string | null
          bw_price?: number
          city?: string | null
          color_price?: number
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          one_pin_price?: number
          owner_user_id: string
          phone: string
          pincode?: string | null
          printer_name?: string | null
          qr_image_path?: string | null
          road?: string | null
          spiral_price?: number
          store_uid: string
          tape_price?: number
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          address_line?: string | null
          agent_token?: string
          area?: string | null
          bw_price?: number
          city?: string | null
          color_price?: number
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          one_pin_price?: number
          owner_user_id?: string
          phone?: string
          pincode?: string | null
          printer_name?: string | null
          qr_image_path?: string | null
          road?: string | null
          spiral_price?: number
          store_uid?: string
          tape_price?: number
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_stores: {
        Row: {
          address_line: string | null
          area: string | null
          bw_price: number | null
          city: string | null
          color_price: number | null
          id: string | null
          latitude: number | null
          longitude: number | null
          name: string | null
          one_pin_price: number | null
          pincode: string | null
          qr_image_path: string | null
          road: string | null
          spiral_price: number | null
          store_uid: string | null
          tape_price: number | null
        }
        Insert: {
          address_line?: string | null
          area?: string | null
          bw_price?: number | null
          city?: string | null
          color_price?: number | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          one_pin_price?: number | null
          pincode?: string | null
          qr_image_path?: string | null
          road?: string | null
          spiral_price?: number | null
          store_uid?: string | null
          tape_price?: number | null
        }
        Update: {
          address_line?: string | null
          area?: string | null
          bw_price?: number | null
          city?: string | null
          color_price?: number | null
          id?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          one_pin_price?: number | null
          pincode?: string | null
          qr_image_path?: string | null
          road?: string | null
          spiral_price?: number | null
          store_uid?: string | null
          tape_price?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_store_by_uid: {
        Args: { _uid: string }
        Returns: {
          address_line: string
          area: string
          bw_price: number
          city: string
          color_price: number
          id: string
          latitude: number
          longitude: number
          name: string
          one_pin_price: number
          pincode: string
          qr_image_path: string
          road: string
          spiral_price: number
          store_uid: string
          tape_price: number
        }[]
      }
      is_store_owner: { Args: { _store_uid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
