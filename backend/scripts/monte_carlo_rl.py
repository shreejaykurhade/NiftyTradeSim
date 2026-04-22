import numpy as np
from faiss_store import FaissStore

class MonteCarloRLAgent:
    """
    A Monte Carlo RL Agent that uses FAISS for continuous state space approximation.
    State: 5D Vector
    Actions: 0 (Hold), 1 (Buy), 2 (Sell)
    """
    def __init__(self, k_neighbors=5, discount_factor=0.99):
        self.k_neighbors = k_neighbors
        self.gamma = discount_factor
        self.store = FaissStore(dimension=5)
        
        # Episode memory
        self.episode_states = []
        self.episode_actions = []
        self.episode_rewards = []
        
        # Action space: 0, 1, 2
        self.num_actions = 3

    def select_action(self, state, epsilon=0.1):
        """
        Epsilon-greedy action selection using FAISS K-NN.
        """
        if np.random.rand() < epsilon:
            return np.random.randint(0, self.num_actions)

        # Query FAISS
        dists, inds, metas = self.store.search(state, k=self.k_neighbors)
        
        if not metas or len(metas) == 0:
            # If memory is empty, return random action
            return np.random.randint(0, self.num_actions)
            
        # metas contain dicts like {'action': a, 'q_value': q}
        # Aggregate Q-values for each action from neighbors
        action_values = {0: [], 1: [], 2: []}
        for m in metas:
            if m is not None:
                action_values[m['action']].append(m['q_value'])
                
        # Calculate expected value for each action based on neighbors
        expected_values = {}
        for a in range(self.num_actions):
            if len(action_values[a]) > 0:
                expected_values[a] = np.mean(action_values[a])
            else:
                expected_values[a] = 0.0 # Default value if no neighbors tried this action
                
        # Return action with highest expected value
        return max(expected_values, key=expected_values.get)

    def store_transition(self, state, action, reward):
        self.episode_states.append(state)
        self.episode_actions.append(action)
        self.episode_rewards.append(reward)

    def finish_episode(self):
        """
        Monte Carlo update: Calculate returns and add to FAISS.
        """
        G = 0
        returns = []
        # Calculate discounted returns backwards
        for r in reversed(self.episode_rewards):
            G = r + self.gamma * G
            returns.insert(0, G)
            
        # Add all state-action-return tuples to FAISS
        metas = []
        for a, ret in zip(self.episode_actions, returns):
            metas.append({'action': a, 'q_value': ret})
            
        if len(self.episode_states) > 0:
            self.store.add_vectors(self.episode_states, metas)
            
        # Clear episode memory
        self.episode_states = []
        self.episode_actions = []
        self.episode_rewards = []

    def save(self, path="mc_agent"):
        self.store.save_index(f"{path}_faiss.bin")
        # In a real scenario, you might also want to save the metadata using pickle or json
        import pickle
        with open(f"{path}_meta.pkl", "wb") as f:
            pickle.dump(self.store.metadata, f)
            
    def load(self, path="mc_agent"):
        self.store.load_index(f"{path}_faiss.bin")
        import pickle
        with open(f"{path}_meta.pkl", "rb") as f:
            self.store.metadata = pickle.load(f)
