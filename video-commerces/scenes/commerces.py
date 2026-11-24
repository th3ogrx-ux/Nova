"""Carte 3D de ville la nuit pour la vidéo "commerces-01" (Nooxel World). Lancer :
   outils/blender-bg.sh scenes/commerces.py --frames 0-659 --out rendu-tmp/f --res 540x960 --samples 12
   outils/blender-bg.sh scenes/commerces.py --times 1.5,4.5,12,17.5,20.5 --out rendu-tmp/s     (images de contrôle)
Tout est piloté par le temps t (en secondes) : apply(t) place la caméra, allume la boutique, déplace les clients."""
import bpy, bmesh, math, sys, time, random
from mathutils import Vector

def arg(nom, defaut):
    return sys.argv[sys.argv.index(nom) + 1] if nom in sys.argv else defaut
FPS = 30
def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
COL = dict(nuit='#040b1c', bleu='#1a6bff', clair='#6fa8ff', ambre='#f5a623', vert='#3ddc97', bloc='#3a4864', gris='#6b7388')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
rx, ry = [int(v) for v in arg('--res', '540x960').split('x')]
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = rx, ry, 100
sc.cycles.device = 'CPU'; sc.cycles.samples = int(arg('--samples', '12'))
sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.06
sc.cycles.max_bounces = 3; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1; sc.cycles.transparent_max_bounces = 6
sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'
W_ = bpy.data.worlds.new('nuit'); sc.world = W_; W_.use_nodes = True
W_.node_tree.nodes['Background'].inputs[0].default_value = (*lin(COL['nuit']), 1)

# ---------------------------------------------------------------- matériaux
MATS = {}
def emit(nom, hexa, force):
    m = bpy.data.materials.new(nom); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (*lin(hexa), 1); e.inputs['Strength'].default_value = force
    o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o.inputs[0]); MATS[nom] = e; return m
def mat_diffus(nom, hexa, rugosite=0.85):
    m = bpy.data.materials.new(nom); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(hexa), 1); b.inputs['Roughness'].default_value = rugosite; MATS[nom] = b; return m
def halo_mat(nom, hexa, force, alpha):
    m = bpy.data.materials.new(nom); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (*lin(hexa), 1); e.inputs['Strength'].default_value = force
    t = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = alpha
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(t.outputs[0], mx.inputs[1]); nt.links.new(e.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs[0])
    MATS[nom + '_mix'] = mx; MATS[nom] = e; return m

m_bloc = mat_diffus('bloc', COL['bloc']); m_bloc2 = mat_diffus('bloc2', '#2e3a54'); m_trottoir = mat_diffus('trottoir', '#101a33')
m_route = emit('route', COL['bleu'], 0.6); m_route2 = emit('route2', COL['bleu'], 0.6); m_trait = emit('trait', COL['clair'], 0.9)
m_amb_fen = emit('amb_fen', COL['ambre'], 1.15); m_amb_sig = emit('amb_sig', COL['ambre'], 1.0)
m_store = mat_diffus('store', COL['bleu'], 0.7); m_porte = mat_diffus('porte', '#18233d')
m_pin = emit('pin', COL['ambre'], 1.25); m_pin_halo = halo_mat('pin_halo', COL['ambre'], 1.0, 0.09)
m_lampe = emit('lampe', '#ffe6b0', 2.0)
# boutique grise (animée)
g_corps = mat_diffus('g_corps', COL['gris'], 0.9); g_fen = emit('g_fen', '#454c5e', 0.35); g_sig = emit('g_sig', '#3a4052', 0.2)
g_photo = emit('g_photo', COL['ambre'], 0.0); g_qr = emit('g_qr', '#ffffff', 0.0); g_store = mat_diffus('g_store', '#59607a', 0.8)
g_anneau = halo_mat('g_anneau', COL['ambre'], 1.4, 0.4); g_halo = halo_mat('g_halo', COL['ambre'], 1.0, 0.0)
g_bell = emit('g_bell', COL['vert'], 0.0)
m_client = emit('client', COL['clair'], 3.0); m_client_halo = halo_mat('client_halo', COL['clair'], 1.2, 0.12)

# ---------------------------------------------------------------- géométrie
base_cube = bpy.data.meshes.new('cube'); _b = bmesh.new(); bmesh.ops.create_cube(_b, size=1.0); _b.to_mesh(base_cube); _b.free()
coll = sc.collection
def objet(nom, mesh, loc, scale=(1, 1, 1), mat=None, rot=(0, 0, 0)):
    me = mesh.copy() if mat is not None else mesh
    if mat is not None: me.materials.clear(); me.materials.append(mat)
    o = bpy.data.objects.new(nom, me); o.location = loc; o.scale = scale; o.rotation_euler = rot; coll.objects.link(o); return o
def box(nom, loc, size, mat, rot=(0, 0, 0)): return objet(nom, base_cube, loc, size, mat, rot)
def sphere(nom, loc, r, mat, seg=20):
    me = bpy.data.meshes.new(nom); b = bmesh.new(); bmesh.ops.create_uvsphere(b, u_segments=seg, v_segments=seg // 2, radius=r); b.to_mesh(me); b.free()
    me.materials.append(mat); o = bpy.data.objects.new(nom, me); o.location = loc; coll.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    return o
# épingle : goutte (sphère + cône pointe en bas), partagée entre toutes les épingles
pin_mesh = bpy.data.meshes.new('pin'); _b = bmesh.new()
bmesh.ops.create_uvsphere(_b, u_segments=20, v_segments=10, radius=0.5, matrix=__import__('mathutils').Matrix.Translation((0, 0, 1.12)))
bmesh.ops.create_cone(_b, cap_ends=False, segments=20, radius1=0.0, radius2=0.42, depth=1.1, matrix=__import__('mathutils').Matrix.Translation((0, 0, 0.55)))
_b.to_mesh(pin_mesh); _b.free(); pin_mesh.materials.append(m_pin)
for p in pin_mesh.polygons: p.use_smooth = True
halo_mesh = bpy.data.meshes.new('halo'); _b = bmesh.new(); bmesh.ops.create_uvsphere(_b, u_segments=40, v_segments=20, radius=1.0); _b.to_mesh(halo_mesh); _b.free()
for p in halo_mesh.polygons: p.use_smooth = True
def pin(nom, loc, echelle=1.0, halo=1.7, mat_halo=None):
    o = objet(nom, pin_mesh, loc, (echelle,) * 3)
    h = objet(nom + '_halo', halo_mesh, (loc[0], loc[1], loc[2] + 1.1 * echelle), (halo * echelle,) * 3, None)
    h.data = halo_mesh.copy(); h.data.materials.append(mat_halo or m_pin_halo); return o, h

rnd = random.Random(5)
# sol : trottoirs et avenue principale (bleue)
box('sol', (0, 0, -0.06), (140, 140, 0.1), m_trottoir)
box('avenue', (0, 0, 0.0), (3.0, 120, 0.05), m_route)
for yy in range(-48, 49, 3): box('tiret', (0, yy, 0.04), (0.14, 1.2, 0.02), m_trait)
for x in (-15, 15, -30, 30): box(f'rue_v{x}', (x, 0, 0.0), (2.4, 120, 0.05), m_route2)
for y in (-16, 14, 30, -32): box(f'rue_h{y}', (0, y, 0.0), (120, 2.4, 0.05), m_route2)
# boutiques le long de l'avenue (x = ±5), la boutique grise est celle de l'est, n°2
Y0 = [(-2.5 + i) * 3.4 for i in range(6)]
GRIS_I, GRIS_SIDE = 2, +1
shops = []
for side in (-1, 1):
    for i, y in enumerate(Y0):
        gris = (side == GRIS_SIDE and i == GRIS_I)
        h = 3.2 + ((i * 7 + (3 if side > 0 else 0)) % 4) * 0.35
        xf = 3.0 * side                                    # façade côté avenue
        corps = box('boutique', (5 * side, y, h / 2), (4, 3.0, h), g_corps if gris else m_bloc)
        fen = box('vitrine', (xf - 0.05 * side, y - 0.2, 1.05), (0.1, 1.9, 1.3), g_fen if gris else m_amb_fen)
        box('porte', (xf - 0.04 * side, y + 1.0, 0.95), (0.08, 0.8, 1.9), m_porte)
        sig = box('enseigne', (xf - 0.05 * side, y, 2.5), (0.1, 2.4, 0.5), g_sig if gris else m_amb_sig)
        box('store', (xf - 0.45 * side, y - 0.2, 2.0), (0.9, 2.4, 0.08), g_store if gris else m_store, rot=(0, math.radians(22 * side), 0))
        shops.append(dict(side=side, i=i, y=y, h=h, gris=gris, x=5 * side))
        # bâtiment arrière
        box('arriere', (10.5 * side, y, (h + 1.2) / 2), (6, 3.0, h + 1.2), m_bloc2)
        # lampadaire
        if i % 2 == 0:
            box('mat', (2.5 * side, y + 1.7, 1.6), (0.07, 0.07, 3.2), m_porte); sphere('lampe', (2.5 * side, y + 1.7, 3.3), 0.16, m_lampe, 10)
# quartiers autour (blocs gris-bleu de hauteurs variées)
for cx in (-22.5, 22.5, -37.5, 37.5, 0):
    for cy in (-24, -8, 6, 22, 38, -40):
        if cx == 0 and abs(cy) < 12: continue
        for k in range(rnd.randint(4, 6)):
            bx, by = cx + rnd.uniform(-5, 5), cy + rnd.uniform(-5, 5)
            if abs(bx) < 14 and abs(by) < 12: continue
            hh = rnd.uniform(1.2, 5.0); box('bloc', (bx, by, hh / 2), (rnd.uniform(2.6, 4.2), rnd.uniform(2.6, 4.2), hh), m_bloc if rnd.random() < .6 else m_bloc2)
# autres blocs derrière l'avenue (extrémités)
for y in (-20, -26, 18, 24):
    for x in (-8, 8): box('bloc', (x, y, 2.0), (5, 4, 4.0), m_bloc2)
# épingles ambrées sur toutes les boutiques allumées + dans la ville
PINS = []
for s in shops:
    if s['gris']: continue
    o, h = pin('pin', (s['x'], s['y'], s['h'] + 0.15), 0.62, 1.6); PINS.append((o, h, rnd.uniform(0, 6.28)))
for k in range(46):
    px, py = rnd.choice([-1, 1]) * rnd.uniform(10, 40), rnd.uniform(-38, 38)
    if abs(px) < 13 and abs(py) < 13: continue
    o, h = pin('pin', (px, py, rnd.uniform(2.0, 5.2)), 0.62, 1.6); PINS.append((o, h, rnd.uniform(0, 6.28)))
# la boutique grise : ses accessoires animés
G = next(s for s in shops if s['gris']); gx, gy, gh = G['x'], G['y'], G['h']; xf = 3.0
photos = [box('photo', (xf - 0.04, gy + dy, 3.0), (0.06, 0.55, 0.36), g_photo) for dy in (-0.8, 0.0, 0.8)]
comptoir = box('comptoir', (xf - 0.25, gy - 0.2, 0.55), (0.4, 1.3, 0.5), m_porte)
qr = box('qr', (xf - 0.46, gy - 0.2, 0.62), (0.02, 0.42, 0.42), g_qr)
g_pin, g_pin_halo = pin('pin_boutique', (gx, gy, gh + 0.15), 0.01, 1.6, g_halo)
cloche = [objet('anneau', halo_mesh, (gx, gy, gh + 0.15 + 1.1 * 0.62), (0.01,) * 3, None) for _ in range(3)]
for c in cloche: c.data = halo_mesh.copy(); c.data.materials.append(g_anneau)
lum = bpy.data.lights.new('lum_boutique', 'POINT'); lum.energy = 0; lum.color = lin(COL['ambre']); lum.shadow_soft_size = 0.6
lum_o = bpy.data.objects.new('lum_boutique', lum); lum_o.location = (xf - 1.5, gy, 1.6); coll.objects.link(lum_o)
# clients : petits points bleus qui rejoignent la boutique
def chemin(depart):                                   # trajet en L le long des rues vers la porte de la boutique
    return [depart, Vector((depart.x, -16 if abs(depart.y + 16) > 0.01 else depart.y, 0.35)), Vector((0, -16, 0.35)), Vector((0, gy, 0.35)), Vector((xf - 0.7, gy, 0.35))]
clients = []
for k in range(28):
    a = k * 2.399; r = 26 + (k % 5) * 4
    dep = Vector((math.cos(a) * r * (1 if abs(math.cos(a)) < 0.3 else 0.6), (-16 if k % 3 else -30) if True else 0, 0.35))
    dep = Vector((rnd.choice([-1, 1]) * rnd.uniform(15, 30), rnd.choice([-16, -16, 14, 30, -32]), 0.35))
    o = sphere('client', dep, 0.22, m_client, 10); hh = objet('client_halo', halo_mesh, dep, (0.7,) * 3, None); hh.data = halo_mesh.copy(); hh.data.materials.append(m_client_halo)
    clients.append(dict(o=o, h=hh, pts=[dep, Vector((dep.x, -16 if dep.y not in (-16,) else -16, 0.35)), Vector((0, -16, 0.35)), Vector((0, gy, 0.35)), Vector((xf - 0.7, gy, 0.35))], t0=16.0 + (k % 9) * 0.05, t1=18.7 - (k % 6) * 0.08))
    clients[-1]['pts'][1] = Vector((dep.x, -16 if dep.y != -16 else -16, 0.35))
    clients[-1]['pts'][1] = Vector((dep.x, -16, 0.35))
# lumière d'ambiance (bleutée, douce) pour lire les volumes
sol_l = bpy.data.lights.new('ciel', 'SUN'); sol_l.energy = 0.55; sol_l.color = lin('#8fb0ff'); sol_l.angle = math.radians(40)
so = bpy.data.objects.new('ciel', sol_l); so.rotation_euler = (math.radians(35), math.radians(-20), math.radians(25)); coll.objects.link(so)
# scène de fin : une épingle ambrée sur fond nuit, loin de la ville
FX, FY = 300.0, 300.0
fin_pin, fin_halo = pin('pin_fin', (FX, FY, 0), 1.0, 1.6)
fin_h2 = objet('fin_halo2', halo_mesh, (FX, FY, 1.1), (3.2,) * 3, None); fin_h2.data = halo_mesh.copy(); fin_h2.data.materials.append(halo_mat('fin_h2', COL['ambre'], 1.0, 0.045))
fin_lum = bpy.data.lights.new('fin', 'POINT'); fin_lum.energy = 300; fin_lum.color = lin(COL['ambre']); fl = bpy.data.objects.new('fin', fin_lum); fl.location = (FX, FY - 3, 3); coll.objects.link(fl)
cam = bpy.data.cameras.new('cam'); cam.lens = 28; cam.shift_y = -0.10; cam_o = bpy.data.objects.new('cam', cam); coll.objects.link(cam_o); sc.camera = cam_o

# ---------------------------------------------------------------- animation pilotée par le temps
def ss(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def lerp(a, b, t): return a + (b - a) * t
def vlerp(a, b, t): return Vector((lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)))
def regarder(pos, cible, roulis=0.0):
    d = Vector(cible) - Vector(pos); cam_o.location = pos; cam_o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam_o.rotation_euler.rotate_axis('Z', roulis)
# temps des 5 coches (alignés sur la voix)
TC = [float(v) for v in arg('--coches', '6.4,8.2,10.0,11.8,13.6').split(',')]
P_STREET = (Vector((-0.6, -11.5, 1.7)), Vector((2.4, 1.0, 1.9)))
P_TOP = (Vector((2.0, -7.5, 27.0)), Vector((3.2, -1.7, 0.0)))
P_SHOP = (Vector((-3.6, -10.5, 6.0)), Vector((3.8, -1.7, 2.2)))
P_FAR = (Vector((-22.0, -26.0, 17.0)), Vector((3.0, -3.0, 0.0)))
def apply(t):
    fin = t >= 19.0
    # --- caméra
    if t < 3.0:
        k = t / 3.0; regarder(P_STREET[0] + Vector((0.5 * k, 1.6 * k, 0)), P_STREET[1])
    elif t < 6.0:
        k = ss((t - 3.0) / 3.0); regarder(vlerp(P_STREET[0] + Vector((0.5, 1.6, 0)), P_TOP[0], k), vlerp(P_STREET[1], P_TOP[1], k), roulis=0)
    elif t < 7.6:
        k = ss((t - 6.0) / 1.6); regarder(vlerp(P_TOP[0], P_SHOP[0], k), vlerp(P_TOP[1], P_SHOP[1], k))
    elif t < 16.0:
        k = (t - 7.6) / 8.4; regarder(P_SHOP[0] + Vector((1.6 * k, -0.4 * k, 0.5 * k)), P_SHOP[1] + Vector((0, 0, 0.2 * k)))
    elif t < 19.0:
        k = ss((t - 16.0) / 3.0); regarder(vlerp(P_SHOP[0] + Vector((1.6, -0.4, 0.5)), P_FAR[0], k), vlerp(P_SHOP[1] + Vector((0, 0, 0.2)), P_FAR[1], k))
    else:
        k = (t - 19.0) / 3.0; regarder(Vector((FX, FY - 8.5 + 0.8 * k, 3.2)), Vector((FX, FY, 2.5)))
    for o in sc.objects: pass
    # --- boutique grise : une étape par coche
    p = [ss((t - tc) / 0.6) for tc in TC]
    allum = p[0]
    g_corps.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*[lerp(a, b, allum) for a, b in zip(lin(COL['gris']), lin('#7a5a3c'))], 1)
    g_store.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*[lerp(a, b, allum) for a, b in zip(lin('#59607a'), lin(COL['bleu']))], 1)
    MATS['g_fen'].inputs['Color'].default_value = (*[lerp(a, b, allum) for a, b in zip(lin('#454c5e'), lin(COL['ambre']))], 1)
    MATS['g_fen'].inputs['Strength'].default_value = lerp(0.35, 1.15 + 0.35 * p[4], allum)
    MATS['g_sig'].inputs['Color'].default_value = (*[lerp(a, b, p[1]) for a, b in zip(lin('#3a4052'), lin(COL['ambre']))], 1); MATS['g_sig'].inputs['Strength'].default_value = lerp(0.2, 1.0, p[1])
    MATS['g_photo'].inputs['Strength'].default_value = 1.3 * p[2]
    MATS['g_qr'].inputs['Strength'].default_value = 1.1 * p[4]
    MATS['g_bell'].inputs['Strength'].default_value = 0.0
    s_pin = 0.62 * (ss((t - TC[0]) / 0.5) * (1 + 0.15 * math.sin(math.pi * min(1, (t - TC[0]) / 0.5))) if t >= TC[0] else 0.0)
    s_pin = max(s_pin, 0.001); g_pin.scale = (s_pin,) * 3; g_pin.location = (gx, gy, gh + 0.15 + 0.1 * math.sin(t * 2.0) * allum)
    boost = 1.0 + 0.18 * (p[1] + p[2] + p[3] + p[4])
    g_pin_halo.scale = (1.6 * s_pin * boost,) * 3; g_pin_halo.location = (gx, gy, gh + 0.15 + 1.1 * s_pin)
    MATS['g_halo_mix'].inputs[0].default_value = 0.10 * allum
    lum.energy = 160 * allum + 120 * p[3] + 100 * p[4]
    # anneaux "bons plans" (étape 4) : ondes qui partent de l'épingle
    for j, c in enumerate(cloche):
        ph = ((t - TC[3]) * 0.9 - j / 3) % 1.0 if t >= TC[3] else 1.0
        r = 0.5 + ph * 3.2 if t >= TC[3] else 0.01; c.scale = (r, r, 0.04); c.location = (gx, gy, gh + 0.2)
        MATS['g_anneau_mix'].inputs[0].default_value = 0.30 * (1 - ph) ** 1.5 if t >= TC[3] else 0.0
    # --- épingles des autres boutiques : léger balancement
    for o, h, ph in PINS:
        d = (o.location - cam_o.location).length; masque = d < 7.0
        o.hide_render = h.hide_render = masque
    # --- clients (plan 4)
    for c in clients:
        if t < c['t0']: c['o'].hide_render = c['h'].hide_render = True; continue
        c['o'].hide_render = c['h'].hide_render = False
        k = ss((t - c['t0']) / (c['t1'] - c['t0'])); pts = c['pts']
        L = [(pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)]; tot = sum(L); d = k * tot; pos = pts[-1]
        for i, l in enumerate(L):
            if d <= l: pos = pts[i].lerp(pts[i + 1], d / l if l else 0); break
            d -= l
        c['o'].location = pos; c['h'].location = pos
        arrive = k >= 1.0
        c['o'].hide_render = c['h'].hide_render = arrive
    # --- scène de fin
    s = 1.0 + 0.04 * math.sin(t * 3); fin_pin.rotation_euler = (0, 0, t * 0.9); fin_pin.location = (FX, FY, 0.15 * math.sin(t * 2))
    fin_halo.scale = (1.7 * s,) * 3; fin_halo.location = (FX, FY, 1.1 + 0.15 * math.sin(t * 2))
    # tout ce qui n'est pas visible dans la scène de fin ne coûte rien : la caméra ne voit que l'épingle

def rendre(t, chemin):
    apply(t); sc.render.filepath = chemin; bpy.ops.render.render(write_still=True)

if __name__ == '__main__' or True:
    if '--times' in sys.argv:
        for tt in [float(v) for v in arg('--times', '1').split(',')]:
            t0 = time.time(); rendre(tt, f"{arg('--out', 'rendu-tmp/s')}_{tt:05.2f}.png"); print(f't={tt}: {time.time() - t0:.1f} s', flush=True)
    elif '--frames' in sys.argv:
        a, b = [int(v) for v in arg('--frames', '0-0').split('-')]
        for f in range(a, b + 1):
            t0 = time.time(); rendre(f / FPS, f"{arg('--out', 'rendu-tmp/f')}{f:05d}.png"); print(f'f={f}: {time.time() - t0:.1f} s', flush=True)
