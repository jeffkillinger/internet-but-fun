export function SingleCube() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial attach="material-0" color="#dc2626" />
      <meshStandardMaterial attach="material-1" color="#f97316" />
      <meshStandardMaterial attach="material-2" color="#ffffff" />
      <meshStandardMaterial attach="material-3" color="#eab308" />
      <meshStandardMaterial attach="material-4" color="#16a34a" />
      <meshStandardMaterial attach="material-5" color="#2563eb" />
    </mesh>
  );
}
