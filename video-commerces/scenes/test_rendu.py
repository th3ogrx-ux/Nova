# Rendu de test : quelques blocs, une rue bleue, une épingle ambrée. Mesure le temps par image.
import bpy, time, sys, math
moteur = sys.argv[1] if len(sys.argv) > 1 else 'CYCLES'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = moteur
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.filepath = f'/tmp/claude-0/-home-user-Nova/6b5dda2c-c3cb-5898-8c00-c41207ed672f/scratchpad/test_{moteur}.png'
if moteur == 'CYCLES':
    sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.0016, 0.0043, 0.0116, 1)
def mat(nom, rgb, emi=0.0):
    m = bpy.data.materials.new(nom); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    if emi: b.inputs['Emission Color'].default_value = (*rgb, 1); b.inputs['Emission Strength'].default_value = emi
    return m
bpy.ops.mesh.primitive_plane_add(size=40); bpy.context.object.data.materials.append(mat('sol', (0.005, 0.01, 0.03)))
for i in range(30):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((i % 6 - 2.5) * 2.2, (i // 6 - 2) * 2.2, 0.5 + (i * 7 % 5) * 0.3))
    o = bpy.context.object; o.scale = (1.4, 1.4, 1 + (i * 7 % 5) * 0.6); o.data.materials.append(mat('b', (0.08, 0.1, 0.16)))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.4, location=(0, 0, 2.5)); bpy.context.object.data.materials.append(mat('amb', (0.9, 0.35, 0.02), 25))
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10)); bpy.context.object.data.energy = 0.6
bpy.ops.object.camera_add(location=(0, -9, 6), rotation=(math.radians(60), 0, 0)); sc.camera = bpy.context.object
t = time.time(); bpy.ops.render.render(write_still=True); print(f'{moteur} : {time.time() - t:.1f} s pour une image 1080x1920')
