--
-- PostgreSQL database dump (Clean schema + seed data)
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

SET default_tablespace = '';
SET default_table_access_method = heap;

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    icon_name character varying(50) DEFAULT NULL::character varying,
    name_en character varying(100)
);

ALTER TABLE public.categories OWNER TO energy_manager;

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.categories_id_seq OWNER TO energy_manager;
ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;

CREATE TABLE public.device_presets (
    id integer NOT NULL,
    category_id integer NOT NULL,
    title character varying(150) NOT NULL,
    power_watts integer NOT NULL,
    priority smallint DEFAULT 3 NOT NULL,
    avg_duration_minutes integer DEFAULT 60 NOT NULL,
    allow_backup_power boolean DEFAULT false NOT NULL,
    title_en character varying(150),
    operating_mode character varying(20) DEFAULT 'flexible'::character varying NOT NULL,
    CONSTRAINT device_presets_operating_mode_check CHECK (((operating_mode)::text = ANY ((ARRAY['continuous'::character varying, 'scheduled'::character varying, 'flexible'::character varying])::text[]))),
    CONSTRAINT device_presets_priority_check CHECK (((priority >= 1) AND (priority <= 5)))
);

ALTER TABLE public.device_presets OWNER TO energy_manager;

CREATE SEQUENCE public.device_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.device_presets_id_seq OWNER TO energy_manager;
ALTER SEQUENCE public.device_presets_id_seq OWNED BY public.device_presets.id;

CREATE TABLE public.power_sources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    type character varying(30) NOT NULL,
    capacity_wh integer DEFAULT 0 NOT NULL,
    max_output_watts integer NOT NULL,
    charge_time_minutes integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT power_sources_type_check CHECK (((type)::text = ANY ((ARRAY['station'::character varying, 'inverter_battery'::character varying, 'generator'::character varying])::text[])))
);

ALTER TABLE public.power_sources OWNER TO energy_manager;

CREATE TABLE public.schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    schedule_date date NOT NULL,
    strategy character varying(30) NOT NULL,
    total_energy_kwh numeric(6,2) NOT NULL,
    total_cost_uah numeric(8,2) NOT NULL,
    schedule_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT schedules_strategy_check CHECK (((strategy)::text = ANY ((ARRAY['peak_shaving'::character varying, 'cost_min'::character varying, 'balanced'::character varying])::text[])))
);

ALTER TABLE public.schedules OWNER TO energy_manager;

CREATE TABLE public.user_devices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    preset_id integer,
    title character varying(150) NOT NULL,
    power_watts integer NOT NULL,
    priority smallint DEFAULT 3 NOT NULL,
    avg_duration_minutes integer DEFAULT 60 NOT NULL,
    allow_backup_power boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    category_id integer,
    operating_mode character varying(20) DEFAULT 'flexible'::character varying NOT NULL,
    CONSTRAINT user_devices_operating_mode_check CHECK (((operating_mode)::text = ANY ((ARRAY['continuous'::character varying, 'scheduled'::character varying, 'flexible'::character varying])::text[]))),
    CONSTRAINT user_devices_priority_check CHECK (((priority >= 1) AND (priority <= 5)))
);

ALTER TABLE public.user_devices OWNER TO energy_manager;

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    max_power_limit_kw numeric(4,2) DEFAULT 3.50 NOT NULL,
    tariff_type character varying(20) DEFAULT 'single'::character varying NOT NULL,
    base_tariff_rate numeric(6,2) DEFAULT 4.32 NOT NULL,
    outage_group character varying(10) DEFAULT NULL::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    language character varying(5) DEFAULT 'uk'::character varying NOT NULL,
    currency character varying(10) DEFAULT 'UAH'::character varying NOT NULL,
    outage_schedule jsonb DEFAULT '[]'::jsonb NOT NULL,
    reset_token_hash character varying(255) DEFAULT NULL::character varying,
    reset_token_expires timestamp with time zone DEFAULT NULL::timestamp with time zone,
    CONSTRAINT users_tariff_type_check CHECK (((tariff_type)::text = ANY ((ARRAY['single'::character varying, 'dual'::character varying, 'triple'::character varying])::text[])))
);

ALTER TABLE public.users OWNER TO energy_manager;

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);
ALTER TABLE ONLY public.device_presets ALTER COLUMN id SET DEFAULT nextval('public.device_presets_id_seq'::regclass);

--
-- Seed data: categories
--
INSERT INTO public.categories VALUES (1, 'Велика побутова техніка', 'large_appliances', 'Large Home Appliances') ON CONFLICT DO NOTHING;
INSERT INTO public.categories VALUES (2, 'Кухонні прилади', 'kitchen', 'Kitchen Appliances') ON CONFLICT DO NOTHING;
INSERT INTO public.categories VALUES (3, 'Клімат та обігрів', 'climate', 'Climate & Heating') ON CONFLICT DO NOTHING;
INSERT INTO public.categories VALUES (6, 'Освітлення, безпека та резерв', 'power_reserve', 'Lighting, Security & Backup') ON CONFLICT DO NOTHING;
INSERT INTO public.categories VALUES (4, 'Електроніка та робоче місце', 'electronics', 'Electronics & Workspace') ON CONFLICT DO NOTHING;
INSERT INTO public.categories VALUES (12, 'Особистий догляд', 'user', 'Personal Care') ON CONFLICT DO NOTHING;
INSERT INTO public.categories VALUES (13, 'Господарські прилади', 'sparkles', 'Household Appliances') ON CONFLICT DO NOTHING;
INSERT INTO public.categories VALUES (14, 'Інструменти та інше', 'wrench', 'Tools & Other') ON CONFLICT DO NOTHING;
INSERT INTO public.categories VALUES (5, 'Догляд та прибирання', 'cleaning', 'Care & Cleaning') ON CONFLICT DO NOTHING;

--
-- Seed data: device_presets
--
INSERT INTO public.device_presets VALUES (1, 1, 'Пральна машина', 2000, 3, 90, false, 'Washing Machine', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (2, 1, 'Бойлер (80л)', 1500, 3, 120, false, 'Water Heater / Boiler (80L)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (31, 3, 'Бойлер електричний (80л)', 1500, 1, 180, false, 'Water Heater / Boiler (80L)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (3, 1, 'Холодильник (NoFrost)', 150, 4, 1440, true, 'Refrigerator (NoFrost)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (8, 1, 'Холодильник (NoFrost, інверторний)', 150, 1, 1440, true, 'Refrigerator (NoFrost, Inverter)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (9, 1, 'Морозильна скриня / камера', 180, 1, 1440, true, 'Chest Freezer', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (10, 1, 'Пральна машина (режим нагріву води)', 2000, 2, 30, false, 'Washing Machine (Water Heating Mode)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (13, 1, 'Посудомийна машина', 1900, 2, 120, false, 'Dishwasher', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (15, 1, 'Варильна поверхня індукційна (1 конфорка)', 1800, 2, 30, false, 'Induction Cooktop (1 Burner)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (16, 1, 'Варильна поверхня індукційна (макс. 4 конфорки)', 6500, 3, 45, false, 'Induction Cooktop (Max 4 Burners)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (4, 2, 'Електрочайник', 2200, 2, 5, false, 'Electric Kettle', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (17, 2, 'Електрочайник', 2000, 2, 5, false, 'Electric Kettle', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (18, 2, 'Мікрохвильова піч', 1200, 2, 10, true, 'Microwave Oven', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (19, 2, 'Мультиварка / Скороварка', 860, 2, 60, true, 'Multicooker / Pressure Cooker', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (20, 2, 'Кавомашина автоматична', 1450, 2, 10, true, 'Automatic Coffee Machine', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (21, 2, 'Тостер', 850, 3, 5, true, 'Toaster', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (22, 2, 'Блендер стаціонарний', 700, 3, 5, true, 'Countertop Blender', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (23, 2, 'Блендер занурювальний', 400, 3, 10, true, 'Immersion Hand Blender', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (24, 2, 'Кухонний комбайн', 1000, 3, 20, true, 'Food Processor', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (25, 2, 'Електрична м''ясорубка', 1500, 3, 15, false, 'Electric Meat Grinder', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (26, 2, 'Електрогриль / Притискний ростер', 2000, 3, 20, false, 'Electric Grill / Contact Toaster', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (27, 2, 'Мультипіч / Аерогриль (Air Fryer)', 1500, 3, 25, false, 'Air Fryer', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (28, 2, 'Соковижималка', 500, 3, 15, true, 'Juicer', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (29, 2, 'Сушарка для овочів та фруктів (Дегідратор)', 450, 3, 480, false, 'Food Dehydrator', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (30, 2, 'Хлібопічка', 650, 3, 180, false, 'Bread Maker', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (5, 3, 'Газовий котел (автоматика + насос)', 120, 5, 1440, true, 'Gas Boiler (Automation + Pump)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (32, 3, 'Газовий котел (автоматика + насос)', 120, 1, 1440, true, 'Gas Boiler (Automation + Pump)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (33, 3, 'Кондиціонер (режим охолодження)', 800, 2, 240, true, 'Air Conditioner (Cooling Mode)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (34, 3, 'Кондиціонер (інверторний обігрів)', 1000, 2, 300, true, 'Air Conditioner (Inverter Heating)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (35, 3, 'Масляний радіатор / Обігрівач', 2000, 3, 180, false, 'Oil-Filled Radiator Heater', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (36, 3, 'Конвектор електричний', 1500, 3, 180, false, 'Electric Convector Heater', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (37, 3, 'Тепловентилятор ("Дуйчик")', 2000, 3, 60, false, 'Fan Heater', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (38, 3, 'Інфрачервоний обігрівач', 1000, 3, 120, false, 'Infrared Heater', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (39, 3, 'Ультразвуковий зволожувач повітря', 30, 2, 480, true, 'Ultrasonic Air Humidifier', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (40, 3, 'Очищувач повітря', 45, 2, 480, true, 'Air Purifier', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (41, 3, 'Вентилятор підлоговий', 45, 3, 240, true, 'Standing Pedestal Fan', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (6, 4, 'Wi-Fi роутер + ONU термінал', 18, 5, 1440, true, 'Wi-Fi Router + Optical ONU Terminal', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (42, 6, 'Wi-Fi роутер + ONU оптичний термінал', 15, 1, 1440, true, 'Wi-Fi Router + Optical ONU Terminal', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (43, 6, 'Світлодіодне освітлення кімнати (LED)', 30, 1, 300, true, 'Room LED Lighting', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (44, 6, 'Настільна LED-лампа', 8, 1, 240, true, 'LED Desk Lamp', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (45, 6, 'Світлодіодна стрічка (5 метрів)', 36, 2, 180, true, 'LED Strip Light (5m)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (7, 6, 'Зарядка станції EcoFlow / Bluetti', 1000, 4, 80, false, 'Power Station Charging (EcoFlow / Bluetti)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (46, 6, 'Зарядна станція (EcoFlow River / Bluetti)', 600, 1, 90, false, 'Power Station (EcoFlow River / Bluetti)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (47, 6, 'Зарядна станція (EcoFlow Delta, швидка зарядка)', 1800, 1, 80, false, 'Power Station (EcoFlow Delta, Fast Charge)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (48, 6, 'ДБЖ (UPS) для ПК / сервера', 300, 1, 1440, false, 'UPS for PC / Server', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (49, 6, 'Система відеоспостереження (Камери + NVR)', 40, 1, 1440, true, 'CCTV System (Cameras + NVR)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (50, 6, 'Охоронна система / Ajax Hub', 5, 1, 1440, true, 'Security System / Ajax Hub', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (51, 4, 'Ноутбук офісний (зарядка/робота)', 65, 1, 480, true, 'Office Laptop (Charging / Work)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (52, 4, 'Ноутбук ігровий / 3D-станція', 230, 1, 360, true, 'Gaming Laptop / 3D Workstation', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (53, 4, 'Стаціонарний ПК (офісний)', 150, 1, 480, true, 'Desktop PC (Office)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (54, 4, 'Стаціонарний ПК (ігровий / рендеринг)', 550, 2, 300, true, 'Desktop PC (Gaming / Rendering)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (55, 4, 'Монітор 27" LED', 30, 1, 480, true, '27" LED Monitor', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (11, 1, 'Пральна машина (режим прання/віджиму)', 400, 2, 60, true, 'Washing Machine (Wash/Spin Mode)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (12, 1, 'Сушильна машина для білизни', 2200, 3, 120, false, 'Clothes Dryer', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (14, 1, 'Електрична духова шафа', 2500, 3, 60, false, 'Electric Oven', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (56, 4, 'Телевізор 43" Smart TV', 75, 2, 180, true, '43" Smart TV', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (57, 4, 'Телевізор 65" QLED / OLED', 160, 2, 180, true, '65" QLED / OLED TV', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (58, 4, 'Ігрова консоль (PlayStation 5 / Xbox Series X)', 200, 3, 120, true, 'Gaming Console (PS5 / Xbox Series X)', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (59, 4, 'Саундбар / Акустична система', 60, 3, 120, true, 'Soundbar / Speaker System', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (60, 4, 'Лазерний БФП / Принтер', 450, 3, 15, false, 'Laser MFP / Printer', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (61, 4, 'Зарядний пристрій для смартфона (Fast Charge)', 30, 1, 60, true, 'Smartphone Fast Charger', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (62, 12, 'Фен для волосся', 2000, 2, 15, false, 'Hair Dryer', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (63, 12, 'Стайлер / Випрямляч для волосся', 65, 3, 20, true, 'Hair Styler / Straightener', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (64, 12, 'Тример / Електробритва', 10, 2, 15, true, 'Trimmer / Electric Shaver', 'continuous') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (65, 13, 'Пилосос підлоговий', 1600, 2, 30, false, 'Vacuum Cleaner', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (66, 13, 'Робот-пилосос (зарядна база)', 40, 2, 120, true, 'Robot Vacuum (Charging Dock)', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (67, 13, 'Праска з парогенератором', 2400, 3, 30, false, 'Steam Generator Iron', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (68, 14, 'Дриль / Перфоратор', 850, 3, 30, false, 'Drill / Rotary Hammer', 'flexible') ON CONFLICT DO NOTHING;
INSERT INTO public.device_presets VALUES (69, 14, 'Зарядний пристрій для акумуляторного інструменту', 90, 3, 60, true, 'Cordless Tool Battery Charger', 'flexible') ON CONFLICT DO NOTHING;

SELECT pg_catalog.setval('public.categories_id_seq', 14, true);
SELECT pg_catalog.setval('public.device_presets_id_seq', 69, true);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_en_key UNIQUE (name_en);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_presets
    ADD CONSTRAINT device_presets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.power_sources
    ADD CONSTRAINT power_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_presets
    ADD CONSTRAINT device_presets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.power_sources
    ADD CONSTRAINT power_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES public.device_presets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;