# SAE — what it is, how it relates to the LLM

## 1. Hidden vector

LLM forward pass = chain of layers. Each layer reads a vector, writes a vector.
Vector size = `d_model` (e.g. 768 for small Pythia, 2304 for Gemma 2-2B).

A "hidden vector" = the activations at ONE chosen point inside the chain,
for ONE token position. Just a list of numbers, one per neuron in that layer.

```
        prompt:  "the cat sat on the"
                          |
                          v
                      +--------+
                      | embed  |
                      +--------+
                          |
                          v   vec_0   (size 768)
                      +--------+
                      | block 1|
                      +--------+
                          |
                          v   vec_1   (size 768)
                      +--------+
                      | block 2|   <-- pick this layer as "the hidden layer"
                      +--------+
                          |
                          v   vec_2   (size 768)   <-- THE HIDDEN VECTOR
                      +--------+
                      | block 3|
                      +--------+
                          |
                          v
                         ...
                          |
                          v
                      +--------+
                      |unembed |
                      +--------+
                          |
                          v
                  logits (size 50,000)
                          |
                          v
                       "mat"
```

`vec_2` is what we mean by "the hidden vector".
Each of its 768 numbers = activation of one neuron at depth 2.

Property: polysemantic. Each number entangles many concepts at once.
Reading it directly tells you nothing.


## 2. Sparse Autoencoder (SAE)

SAE = a small SEPARATE autoencoder. Trained AFTER the LLM is fully done.
Attached to ONE chosen layer of the LLM (e.g. block 2's output).

Two halves:
- encoder: dense vec_2 (size 768) -> wide sparse code s (size ~16,000)
- decoder: sparse code s -> reconstructed vec_2 (size 768, ~ original)

During training a sparsity penalty forces most entries of s to be zero.
Result: only ~50 of 16,000 slots are nonzero for any given vec_2.
Each nonzero slot = ONE human-nameable concept.

```
                vec_2  (dense, 768 nums, polysemantic)
                 |  ^
        encode   |  |   decode
                 v  |
                 sparse code s  (wide, e.g. 16,000 slots)
                 mostly zero, ~50 nonzero
                 each nonzero slot = one named feature

  example slots that fire for "the cat sat on the ___":
     s[42]   = 0.81   "feline noun"
     s[1733] = 0.62   "completed-action verb"
     s[8901] = 0.55   "definite article + noun phrase"
     ... rest = 0
```

The LLM does NOT change. It runs its normal forward pass.
SAE is a side module that reads vec_2 and outputs s.
We inspect s to understand what the LLM is "thinking" at that layer.


## 3. How they connect (full picture)

```
   prompt: "the cat sat on the"
              |
              v
       +-------------+
       | embed       |
       +-------------+
              |
              v
       +-------------+
       | block 1     |
       +-------------+
              |
              v
       +-------------+
       | block 2     |---- vec_2 ---->  +-----------+
       +-------------+         (read)   | SAE       |
              |                         |  encode   |
              |                         |    |      |
              v                         |    v      |
       +-------------+                  | sparse s  |
       | block 3     |                  |  ~50 lit  |
       +-------------+                  |  out of   |
              |                         |  16,000   |
              v                         +-----------+
             ...
              |
              v
       +-------------+
       | unembed     |
       +-------------+
              |
              v
           "mat"
```

Key points:
- Forward pass flows top-to-bottom unaffected.
- SAE is a side branch attached to block 2's output.
- We READ s for interpretation. The LLM never sees s.
- (Optional, for SHIFT) you CAN splice SAE into the forward pass:
  block 2 -> vec_2 -> encode -> s -> decode -> reconstructed vec_2 -> block 3.
  Now you can zero individual entries of s and see how output changes.
  This is intervention mode, not the default.


## 4. What scene 03 should show

A condensed cartoon of the picture above:

```
                  Title: "Sparse Autoencoder"

  prompt:        LLM forward pass (horizontal):           output:
  "the cat ..." -> [emb] -> [b1] -> [b2] -> [b3] -> ... -> "mat"
                                      |
                                      | vec_2 (dim, polysemantic)
                                      |  drawn as small column of
                                      |  ~6 dim circles
                                      |
                                      v
                              +---------------+
                              |  SAE encoder  |
                              +---------------+
                                      |
                                      v
                              s: wide column of
                              ~12 orange circles
                              ALL DARK except ONE
                              that glows bright
                              (= the active feature)
                                      |
                                      | label arrow:
                                      |    "feline noun"
                                      v
                              +---------------+
                              |  SAE decoder  |
                              +---------------+
                                      |
                                      v
                          (reconstructed vec_2,
                           rejoins forward pass into b3)
```

Three trials:
- "the cat sat on the ___"          -> vec_2 pattern A -> SAE slot 2 lights ("feline noun")
- "she opened the ___"              -> vec_2 pattern B -> SAE slot 5 lights ("door-opening event")
- "I drank a cup of ___"            -> vec_2 pattern C -> SAE slot 9 lights ("beverage noun")

For each, the LLM still produces its prediction normally; SAE just reveals
WHICH interpretable feature was active at block 2.

Polysemy contrast: same hidden NEURONS in vec_2 light up across all three
prompts (carried over from scene 02's polysemy lesson).
But in s, a DIFFERENT, single slot lights up each time -> sparse, clean,
interpretable.
