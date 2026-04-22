import faiss
import numpy as np

class FaissStore:
    """
    A vector database wrapper using FAISS to store and query event states.
    For the Trader Agent, the default dimension is 10 (5D Stock + 5D News).
    """
    def __init__(self, dimension=10):
        self.dimension = dimension
        # Use L2 (Euclidean) distance for simple K-NN
        self.index = faiss.IndexFlatL2(self.dimension)
        self.metadata = [] # To store metadata (like date, symbol, true_action) associated with each vector

    def add_vector(self, vector, meta=None):
        """
        Add a single 5D vector to the index.
        vector: numpy array of shape (5,)
        """
        # FAISS expects 2D arrays, shape (n, d)
        vec_2d = np.array([vector], dtype=np.float32)
        self.index.add(vec_2d)
        self.metadata.append(meta)

    def add_vectors(self, vectors, metas):
        """
        Add multiple vectors to the index.
        vectors: numpy array of shape (n, 5)
        """
        if len(vectors) == 0: return
        self.index.add(np.array(vectors, dtype=np.float32))
        self.metadata.extend(metas)

    def search(self, query_vector, k=5):
        """
        Search for the k nearest neighbors.
        Returns distances, indices, and metadata of the neighbors.
        """
        if self.index.ntotal == 0:
            return [], [], []
            
        q_vec = np.array([query_vector], dtype=np.float32)
        distances, indices = self.index.search(q_vec, k)
        
        # Flatten results since we query 1 vector
        dists = distances[0]
        inds = indices[0]
        
        results_meta = []
        for idx in inds:
            if idx != -1 and idx < len(self.metadata):
                results_meta.append(self.metadata[idx])
            else:
                results_meta.append(None)
                
        return dists, inds, results_meta

    def save_index(self, path="faiss_index.bin"):
        faiss.write_index(self.index, path)
        
    def load_index(self, path="faiss_index.bin"):
        self.index = faiss.read_index(path)
