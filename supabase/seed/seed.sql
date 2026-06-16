-- Seed inicial - El Pollón
-- Ejecutar DESPUÉS de crear el usuario super_admin en Supabase Auth
-- Reemplaza 'SUPER_ADMIN_USER_ID' con el UUID real del usuario

-- Sucursales
INSERT INTO branches (id, name, city, address, phone, whatsapp, opening_hours, brand_color, is_active) VALUES
  ('a1111111-1111-1111-1111-111111111101', 'El Pollón Iquique', 'Iquique', 'Av. Arturo Prat 1234', '+56 9 1234 5678', '+56912345678', 'Lun-Dom 11:00 - 23:00', '#c50000', true),
  ('a1111111-1111-1111-1111-111111111102', 'El Pollón Alto Hospicio', 'Alto Hospicio', 'Av. Los Condores 567', '+56 9 2345 6789', '+56923456789', 'Lun-Dom 11:00 - 23:00', '#c50000', true),
  ('a1111111-1111-1111-1111-111111111103', 'El Pollón Arica Santa María', 'Arica', 'Av. Santa María 890', '+56 9 3456 7890', '+56934567890', 'Lun-Dom 11:00 - 23:00', '#c50000', true),
  ('a1111111-1111-1111-1111-111111111104', 'El Pollón Arica Saucache', 'Arica', 'Sector Saucache 321', '+56 9 4567 8901', '+56945678901', 'Lun-Dom 11:00 - 23:00', '#c50000', true)
ON CONFLICT (id) DO NOTHING;

-- Plantillas iniciales
INSERT INTO post_templates (name, type, platform, html_template, default_caption, is_active) VALUES
  ('Oferta Familiar', 'oferta', 'all', 'oferta-familiar', '🔥 ¡Oferta familiar imperdible en El Pollón! Pollo a la brasa recién salido del horno. Pide por WhatsApp 📲', true),
  ('Combo para Dos', 'combo', 'all', 'combo-dos', '💑 Combo para dos: el mejor pollo a la brasa de Iquique. ¡Comparte y disfruta! #ElPollon #PolloALaBrasa', true),
  ('Delivery Rápido', 'delivery', 'all', 'delivery', '🛵 Delivery rápido y seguro. Tu pollo a la brasa llega caliente a tu puerta. ¡Pide ahora! #DeliveryElPollon', true),
  ('Producto Destacado', 'producto_destacado', 'all', 'producto-destacado', '⭐ Nuestro plato estrella: pollo a la brasa con papas doradas y ensalada fresca. ¡El sabor que te encanta!', true),
  ('Promoción Fin de Semana', 'promocion', 'all', 'promo-fin-semana', '🎉 ¡Fin de semana en El Pollón! Promociones especiales para toda la familia. No te lo pierdas 🍗', true),
  ('Testimonio Cliente', 'testimonio', 'all', 'testimonio', '💬 Nuestros clientes nos eligen por el sabor auténtico del pollo a la brasa peruano. ¡Gracias por su preferencia!', true),
  ('Horario Especial', 'horario', 'all', 'horario', '🕐 Te esperamos con el mejor pollo a la brasa. Consulta nuestros horarios y visítanos. #ElPollon', true),
  ('Fecha Especial', 'fecha_especial', 'all', 'fecha-especial', '🎊 Celebra con nosotros. Ofertas especiales en fechas importantes. El Pollón, siempre contigo.', true)
ON CONFLICT DO NOTHING;

-- Actualizar super_admin (ejecutar manualmente con tu user id):
-- UPDATE profiles SET role = 'super_admin', branch_id = NULL WHERE email = 'admin@elpollon.cl';
