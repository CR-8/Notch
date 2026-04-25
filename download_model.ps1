# Download model files for Notch local RAG
# Target: public/models/Xenova/all-MiniLM-L6-v2/

$BaseURL = "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main"
$OutputDir = "public/models/Xenova/all-MiniLM-L6-v2"

# Create directories
New-Item -ItemType Directory -Force -Path "$OutputDir/onnx"

$Files = @(
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "onnx/model_quantized.onnx"
)

foreach ($File in $Files) {
    $Url = "$BaseURL/$File"
    $Dest = "$OutputDir/$File"
    Write-Host "Downloading $File..."
    Invoke-WebRequest -Uri $Url -OutFile $Dest
}

Write-Host "Done! Local model set up for offline RAG."
