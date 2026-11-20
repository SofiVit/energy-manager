--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 24706)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5126 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 238 (class 1255 OID 24929)
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 222 (class 1259 OID 24742)
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    icon_name character varying(50) DEFAULT NULL::character varying,
    name_en character varying(100)
);


--
-- TOC entry 221 (class 1259 OID 24741)
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5127 (class 0 OID 0)
-- Dependencies: 221
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- TOC entry 224 (class 1259 OID 24754)
-- Name: device_presets; Type: TABLE; Schema: public; Owner: -
--

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


--
-- TOC entry 223 (class 1259 OID 24753)
-- Name: device_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5128 (class 0 OID 0)
-- Dependencies: 223
-- Name: device_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_presets_id_seq OWNED BY public.device_presets.id;


--
-- TOC entry 226 (class 1259 OID 24810)
-- Name: power_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.power_sources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    type character varying(30) NOT NULL,
    capacity_wh integer DEFAULT 0 NOT NULL,
    max_output_watts integer NOT NULL,
    charge_time_minutes integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_sources_capacity CHECK (((capacity_wh >= 0) AND (max_output_watts > 0))),
    CONSTRAINT power_sources_type_check CHECK (((type)::text = ANY ((ARRAY['station'::character varying, 'inverter_battery'::character varying, 'generator'::character varying])::text[])))
);


--
-- TOC entry 227 (class 1259 OID 24830)
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    schedule_date date NOT NULL,
    strategy character varying(30) NOT NULL,
    total_energy_kwh numeric(6,2) NOT NULL,
    total_cost_uah numeric(8,2) NOT NULL,
    schedule_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT schedules_strategy_check CHECK (((strategy)::text = ANY ((ARRAY['peak_shaving'::character varying, 'cost_min'::character varying, 'balanced'::character varying])::text[])))
);


--
-- TOC entry 225 (class 1259 OID 24778)
-- Name: user_devices; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    category_id integer,
    operating_mode character varying(20) DEFAULT 'flexible'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_devices_duration CHECK (((avg_duration_minutes >= 1) AND (avg_duration_minutes <= 1440))),
    CONSTRAINT chk_devices_power_pos CHECK ((power_watts > 0)),
    CONSTRAINT user_devices_operating_mode_check CHECK (((operating_mode)::text = ANY ((ARRAY['continuous'::character varying, 'scheduled'::character varying, 'flexible'::character varying])::text[]))),
    CONSTRAINT user_devices_priority_check CHECK (((priority >= 1) AND (priority <= 5)))
);


--
-- TOC entry 220 (class 1259 OID 24717)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    max_power_limit_kw numeric(4,2) DEFAULT 3.50 NOT NULL,
    tariff_type character varying(20) DEFAULT 'single'::character varying NOT NULL,
    base_tariff_rate numeric(6,2) DEFAULT 4.32 NOT NULL,
    outage_group character varying(10) DEFAULT NULL::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    language character varying(5) DEFAULT 'uk'::character varying NOT NULL,
    currency character varying(10) DEFAULT 'UAH'::character varying NOT NULL,
    outage_schedule jsonb DEFAULT '[]'::jsonb NOT NULL,
    reset_token_hash character varying(255),
    reset_token_expires timestamp with time zone,
    password_changed_at timestamp with time zone,
    CONSTRAINT chk_users_lang CHECK (((language)::text = ANY ((ARRAY['uk'::character varying, 'en'::character varying])::text[]))),
    CONSTRAINT chk_users_limit_pos CHECK ((max_power_limit_kw > (0)::numeric)),
    CONSTRAINT chk_users_outage_array CHECK ((jsonb_typeof(outage_schedule) = 'array'::text)),
    CONSTRAINT users_tariff_type_check CHECK (((tariff_type)::text = ANY ((ARRAY['single'::character varying, 'dual'::character varying, 'triple'::character varying])::text[])))
);


--
-- TOC entry 4899 (class 2604 OID 24745)
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- TOC entry 4901 (class 2604 OID 24757)
-- Name: device_presets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_presets ALTER COLUMN id SET DEFAULT nextval('public.device_presets_id_seq'::regclass);


--
-- TOC entry 5115 (class 0 OID 24742)
-- Dependencies: 222
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, icon_name, name_en) FROM stdin;
1	Велика побутова техніка	large_appliances	Large Home Appliances
2	Кухонні прилади	kitchen	Kitchen Appliances
3	Клімат та обігрів	climate	Climate & Heating
6	Освітлення, безпека та резерв	power_reserve	Lighting, Security & Backup
4	Електроніка та робоче місце	electronics	Electronics & Workspace
12	Особистий догляд	user	Personal Care
13	Господарські прилади	sparkles	Household Appliances
14	Інструменти та інше	wrench	Tools & Other
5	Догляд та прибирання	cleaning	Care & Cleaning
\.


--
-- TOC entry 5117 (class 0 OID 24754)
-- Dependencies: 224
-- Data for Name: device_presets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.device_presets (id, category_id, title, power_watts, priority, avg_duration_minutes, allow_backup_power, title_en, operating_mode) FROM stdin;
1	1	Пральна машина	2000	3	90	f	Washing Machine	flexible
2	1	Бойлер (80л)	1500	3	120	f	Water Heater / Boiler (80L)	flexible
31	3	Бойлер електричний (80л)	1500	1	180	f	Water Heater / Boiler (80L)	flexible
3	1	Холодильник (NoFrost)	150	4	1440	t	Refrigerator (NoFrost)	continuous
8	1	Холодильник (NoFrost, інверторний)	150	1	1440	t	Refrigerator (NoFrost, Inverter)	continuous
9	1	Морозильна скриня / камера	180	1	1440	t	Chest Freezer	continuous
10	1	Пральна машина (режим нагріву води)	2000	2	30	f	Washing Machine (Water Heating Mode)	flexible
13	1	Посудомийна машина	1900	2	120	f	Dishwasher	flexible
15	1	Варильна поверхня індукційна (1 конфорка)	1800	2	30	f	Induction Cooktop (1 Burner)	flexible
16	1	Варильна поверхня індукційна (макс. 4 конфорки)	6500	3	45	f	Induction Cooktop (Max 4 Burners)	flexible
4	2	Електрочайник	2200	2	5	f	Electric Kettle	flexible
17	2	Електрочайник	2000	2	5	f	Electric Kettle	continuous
18	2	Мікрохвильова піч	1200	2	10	t	Microwave Oven	continuous
19	2	Мультиварка / Скороварка	860	2	60	t	Multicooker / Pressure Cooker	flexible
20	2	Кавомашина автоматична	1450	2	10	t	Automatic Coffee Machine	continuous
21	2	Тостер	850	3	5	t	Toaster	continuous
22	2	Блендер стаціонарний	700	3	5	t	Countertop Blender	continuous
23	2	Блендер занурювальний	400	3	10	t	Immersion Hand Blender	continuous
24	2	Кухонний комбайн	1000	3	20	t	Food Processor	continuous
25	2	Електрична м'ясорубка	1500	3	15	f	Electric Meat Grinder	continuous
26	2	Електрогриль / Притискний ростер	2000	3	20	f	Electric Grill / Contact Toaster	flexible
27	2	Мультипіч / Аерогриль (Air Fryer)	1500	3	25	f	Air Fryer	flexible
28	2	Соковижималка	500	3	15	t	Juicer	continuous
29	2	Сушарка для овочів та фруктів (Дегідратор)	450	3	480	f	Food Dehydrator	flexible
30	2	Хлібопічка	650	3	180	f	Bread Maker	flexible
5	3	Газовий котел (автоматика + насос)	120	5	1440	t	Gas Boiler (Automation + Pump)	continuous
32	3	Газовий котел (автоматика + насос)	120	1	1440	t	Gas Boiler (Automation + Pump)	continuous
33	3	Кондиціонер (режим охолодження)	800	2	240	t	Air Conditioner (Cooling Mode)	flexible
34	3	Кондиціонер (інверторний обігрів)	1000	2	300	t	Air Conditioner (Inverter Heating)	flexible
35	3	Масляний радіатор / Обігрівач	2000	3	180	f	Oil-Filled Radiator Heater	flexible
36	3	Конвектор електричний	1500	3	180	f	Electric Convector Heater	flexible
37	3	Тепловентилятор ("Дуйчик")	2000	3	60	f	Fan Heater	flexible
38	3	Інфрачервоний обігрівач	1000	3	120	f	Infrared Heater	flexible
39	3	Ультразвуковий зволожувач повітря	30	2	480	t	Ultrasonic Air Humidifier	continuous
40	3	Очищувач повітря	45	2	480	t	Air Purifier	continuous
41	3	Вентилятор підлоговий	45	3	240	t	Standing Pedestal Fan	continuous
6	4	Wi-Fi роутер + ONU термінал	18	5	1440	t	Wi-Fi Router + Optical ONU Terminal	continuous
42	6	Wi-Fi роутер + ONU оптичний термінал	15	1	1440	t	Wi-Fi Router + Optical ONU Terminal	continuous
43	6	Світлодіодне освітлення кімнати (LED)	30	1	300	t	Room LED Lighting	continuous
44	6	Настільна LED-лампа	8	1	240	t	LED Desk Lamp	continuous
45	6	Світлодіодна стрічка (5 метрів)	36	2	180	t	LED Strip Light (5m)	continuous
7	6	Зарядка станції EcoFlow / Bluetti	1000	4	80	f	Power Station Charging (EcoFlow / Bluetti)	flexible
46	6	Зарядна станція (EcoFlow River / Bluetti)	600	1	90	f	Power Station (EcoFlow River / Bluetti)	flexible
47	6	Зарядна станція (EcoFlow Delta, швидка зарядка)	1800	1	80	f	Power Station (EcoFlow Delta, Fast Charge)	flexible
48	6	ДБЖ (UPS) для ПК / сервера	300	1	1440	f	UPS for PC / Server	continuous
49	6	Система відеоспостереження (Камери + NVR)	40	1	1440	t	CCTV System (Cameras + NVR)	continuous
50	6	Охоронна система / Ajax Hub	5	1	1440	t	Security System / Ajax Hub	continuous
51	4	Ноутбук офісний (зарядка/робота)	65	1	480	t	Office Laptop (Charging / Work)	continuous
52	4	Ноутбук ігровий / 3D-станція	230	1	360	t	Gaming Laptop / 3D Workstation	continuous
53	4	Стаціонарний ПК (офісний)	150	1	480	t	Desktop PC (Office)	continuous
54	4	Стаціонарний ПК (ігровий / рендеринг)	550	2	300	t	Desktop PC (Gaming / Rendering)	continuous
55	4	Монітор 27" LED	30	1	480	t	27" LED Monitor	continuous
11	1	Пральна машина (режим прання/віджиму)	400	2	60	t	Washing Machine (Wash/Spin Mode)	flexible
12	1	Сушильна машина для білизни	2200	3	120	f	Clothes Dryer	flexible
14	1	Електрична духова шафа	2500	3	60	f	Electric Oven	flexible
56	4	Телевізор 43" Smart TV	75	2	180	t	43" Smart TV	continuous
57	4	Телевізор 65" QLED / OLED	160	2	180	t	65" QLED / OLED TV	continuous
58	4	Ігрова консоль (PlayStation 5 / Xbox Series X)	200	3	120	t	Gaming Console (PS5 / Xbox Series X)	continuous
59	4	Саундбар / Акустична система	60	3	120	t	Soundbar / Speaker System	continuous
60	4	Лазерний БФП / Принтер	450	3	15	f	Laser MFP / Printer	continuous
61	4	Зарядний пристрій для смартфона (Fast Charge)	30	1	60	t	Smartphone Fast Charger	continuous
62	12	Фен для волосся	2000	2	15	f	Hair Dryer	continuous
63	12	Стайлер / Випрямляч для волосся	65	3	20	t	Hair Styler / Straightener	continuous
64	12	Тример / Електробритва	10	2	15	t	Trimmer / Electric Shaver	continuous
65	13	Пилосос підлоговий	1600	2	30	f	Vacuum Cleaner	flexible
66	13	Робот-пилосос (зарядна база)	40	2	120	t	Robot Vacuum (Charging Dock)	flexible
67	13	Праска з парогенератором	2400	3	30	f	Steam Generator Iron	flexible
68	14	Дриль / Перфоратор	850	3	30	f	Drill / Rotary Hammer	flexible
69	14	Зарядний пристрій для акумуляторного інструменту	90	3	60	t	Cordless Tool Battery Charger	flexible
\.


--
-- TOC entry 5119 (class 0 OID 24810)
-- Dependencies: 226
-- Data for Name: power_sources; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.power_sources (id, user_id, title, type, capacity_wh, max_output_watts, charge_time_minutes, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 5120 (class 0 OID 24830)
-- Dependencies: 227
-- Data for Name: schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schedules (id, user_id, schedule_date, strategy, total_energy_kwh, total_cost_uah, schedule_data, created_at) FROM stdin;
\.


--
-- TOC entry 5118 (class 0 OID 24778)
-- Dependencies: 225
-- Data for Name: user_devices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_devices (id, user_id, preset_id, title, power_watts, priority, avg_duration_minutes, allow_backup_power, is_active, created_at, category_id, operating_mode, updated_at) FROM stdin;
\.


--
-- TOC entry 5113 (class 0 OID 24717)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password_hash, max_power_limit_kw, tariff_type, base_tariff_rate, outage_group, created_at, updated_at, language, currency, outage_schedule, reset_token_hash, reset_token_expires, password_changed_at) FROM stdin;
\.


--
-- TOC entry 5129 (class 0 OID 0)
-- Dependencies: 221
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 14, true);


--
-- TOC entry 5130 (class 0 OID 0)
-- Dependencies: 223
-- Name: device_presets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.device_presets_id_seq', 69, true);


--
-- TOC entry 4940 (class 2606 OID 24890)
-- Name: categories categories_name_en_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_en_key UNIQUE (name_en);


--
-- TOC entry 4942 (class 2606 OID 24752)
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- TOC entry 4944 (class 2606 OID 24750)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4946 (class 2606 OID 24772)
-- Name: device_presets device_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_presets
    ADD CONSTRAINT device_presets_pkey PRIMARY KEY (id);


--
-- TOC entry 4953 (class 2606 OID 24824)
-- Name: power_sources power_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_sources
    ADD CONSTRAINT power_sources_pkey PRIMARY KEY (id);


--
-- TOC entry 4956 (class 2606 OID 24846)
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 4950 (class 2606 OID 24799)
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- TOC entry 4936 (class 2606 OID 24740)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4938 (class 2606 OID 24738)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4951 (class 1259 OID 24920)
-- Name: idx_power_sources_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_power_sources_user ON public.power_sources USING btree (user_id);


--
-- TOC entry 4947 (class 1259 OID 24922)
-- Name: idx_presets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presets_category ON public.device_presets USING btree (category_id);


--
-- TOC entry 4954 (class 1259 OID 24921)
-- Name: idx_schedules_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_user_created ON public.schedules USING btree (user_id, created_at DESC);


--
-- TOC entry 4948 (class 1259 OID 24919)
-- Name: idx_user_devices_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_devices_user_active ON public.user_devices USING btree (user_id, is_active);


--
-- TOC entry 4933 (class 1259 OID 24917)
-- Name: idx_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_email_lower ON public.users USING btree (lower((email)::text));


--
-- TOC entry 4934 (class 1259 OID 24918)
-- Name: idx_users_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_reset_token ON public.users USING btree (reset_token_hash) WHERE (reset_token_hash IS NOT NULL);


--
-- TOC entry 4965 (class 2620 OID 24932)
-- Name: power_sources trg_power_sources_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_power_sources_updated_at BEFORE UPDATE ON public.power_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 4964 (class 2620 OID 24931)
-- Name: user_devices trg_user_devices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_devices_updated_at BEFORE UPDATE ON public.user_devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 4963 (class 2620 OID 24930)
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 4957 (class 2606 OID 24773)
-- Name: device_presets device_presets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_presets
    ADD CONSTRAINT device_presets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- TOC entry 4961 (class 2606 OID 24825)
-- Name: power_sources power_sources_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.power_sources
    ADD CONSTRAINT power_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4962 (class 2606 OID 24847)
-- Name: schedules schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4958 (class 2606 OID 24893)
-- Name: user_devices user_devices_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- TOC entry 4959 (class 2606 OID 24805)
-- Name: user_devices user_devices_preset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_preset_id_fkey FOREIGN KEY (preset_id) REFERENCES public.device_presets(id) ON DELETE SET NULL;


--
-- TOC entry 4960 (class 2606 OID 24800)
-- Name: user_devices user_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- Completed on 2026-11-20 14:09:35

--
-- PostgreSQL database dump complete
--

